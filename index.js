module.exports = {
  findInterface,
  findInterfaces,
  normalize,
  randomize,
  setInterfaceMAC
}

var cp = require('child_process')
var quote = require('shell-quote').quote
var zeroFill = require('zero-fill')
var Winreg = require('winreg')

// Path to Airport binary on macOS 10.7+
var PATH_TO_AIRPORT = '/System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport'

// Windows registry key for interface MAC. Checked on Windows 7
var WIN_REGISTRY_PATH = '\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4D36E972-E325-11CE-BFC1-08002BE10318}'

// Regex to validate a MAC address
// Example: 00-00-00-00-00-00 or 00:00:00:00:00:00 or 000000000000
var MAC_ADDRESS_RE = /([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})/i

// Regex to validate a MAC address in cisco-style
// Example: 0123.4567.89ab
var CISCO_MAC_ADDRESS_RE = /([0-9A-F]{0,4})\.([0-9A-F]{0,4})\.([0-9A-F]{0,4})/i

/**
 * Returns the list of interfaces found on this machine as reported by the
 * `networksetup` command.
 * @param {Array.<string>|null} targets
 * @return {Array.<Object>)}
 */
function findInterfaces (targets) {
  targets = targets || []

  targets = targets.map(function (target) {
    return target.toLowerCase()
  })

  var output, interfaces, details, result, i, port, device, address, it, j, target, lines

  if (process.platform === 'darwin') {
    // Parse the output of `networksetup -listallhardwareports` which gives
    // us 3 fields per port:
    // - the port name,
    // - the device associated with this port, if any,
    // - the MAC address, if any, otherwise 'N/A'

    try {
      output = cp.execSync('networksetup -listallhardwareports').toString()
    } catch (err) {
      throw err
    }
    details = []
    while (true) {
      result = /(?:Hardware Port|Device|Ethernet Address): (.+)/.exec(output)
      if (!result || !result[1]) {
        break
      }
      details.push(result[1])
      output = output.slice(result.index + result[1].length)
    }

    interfaces = [] // to return

    // Split the results into chunks of 3 (for our three fields) and yield
    // those that match `targets`.
    for (i = 0; i < details.length; i += 3) {
      port = details[i]
      device = details[i + 1]
      address = details[i + 2]

      address = MAC_ADDRESS_RE.exec(address.toUpperCase())
      if (address) {
        address = normalize(address[0])
      }

      it = {
        address: address,
        currentAddress: getInterfaceMAC(device),
        device: device,
        port: port
      }

      if (targets.length === 0) {
        // Not trying to match anything in particular, return everything.
        interfaces.push(it)
        continue
      }

      for (j = 0; j < targets.length; j++) {
        target = targets[j]
        if (target === port.toLowerCase() || target === device.toLowerCase()) {
          interfaces.push(it)
          break
        }
      }
    }
  } else if (process.platform === 'linux') {
    // Parse the output of `ifconfig` which gives us:
    // - the adapter description
    // - the adapter name/device associated with this, if any,
    // - the MAC address, if any
    try {
      output = cp.execSync('ifconfig', { stdio: 'pipe' }).toString()
    } catch (err) {
      throw err
    }

    details = []
    while (true) {
      result = /(.*?)HWaddr(.*)/mi.exec(output)
      if (!result || !result[1] || !result[2]) {
        break
      }
      details.push(result[1], result[2])
      output = output.slice(result.index + result[0].length)
    }

    interfaces = []

    for (i = 0; i < details.length; i += 2) {
      var s = details[i].split(':')
      if (s.length >= 2) {
        device = s[0].split(' ')[0]
        port = s[1].trim()
      }

      address = details[i + 1].trim()
      if (address) {
        address = normalize(address)
      }

      it = {
        address: address,
        currentAddress: getInterfaceMAC(device),
        device: device,
        port: port
      }

      if (targets.length === 0) {
        // Not trying to match anything in particular, return everything.
        interfaces.push(it)
        continue
      }

      for (j = 0; j < targets.length; j++) {
        target = targets[j]
        if (target === port.toLowerCase() || target === device.toLowerCase()) {
          interfaces.push(it)
          break
        }
      }
    }
  } else if (process.platform === 'win32') {
    try {
      output = cp.execSync('ipconfig /all', { stdio: 'pipe' }).toString()
    } catch (err) {
      throw err
    }

    details = []
    interfaces = []
    lines = output.split('\n')
    it = false
    for (i = 0; i < lines.length; i++) {
      // Check if new device
      if (lines[i].substr(0, 1).match(/[A-Z]/)) {
        if (it) {
          if (targets.length === 0) {
            // Not trying to match anything in particular, return everything.
            interfaces.push(it)
          } else {
            for (j = 0; j < targets.length; j++) {
              target = targets[j]
              if (target === it.port.toLowerCase() || target === it.device.toLowerCase()) {
                interfaces.push(it)
                break
              }
            }
          }
        }

        it = {
          port: '',
          device: ''
        }

        result = /adapter (.+?):/.exec(lines[ i ])
        if (!result) {
          continue
        }

        it.device = result[1]
      }

      if (!it) {
        continue
      }

      // Try to find address
      result = /Physical Address.+?:(.*)/mi.exec(lines[i])
      if (result) {
        it.address = normalize(result[1].trim())
        it.currentAddress = it.address
        continue
      }

      // Try to find description
      result = /description.+?:(.*)/mi.exec(lines[i])
      if (result) {
        it.description = result[1].trim()
        continue
      }
    }
  }

  return interfaces
}

/**
 * Returns the first interface which matches `target`
 * @param  {string} target
 * @return {Object}
 */
function findInterface (target) {
  var interfaces = findInterfaces([target])
  return interfaces && interfaces[0]
}

/**
 * Returns currently-set MAC address of given interface. This is distinct from the
 * interface's hardware MAC address.
 * @return {string}
 */
function getInterfaceMAC (device) {
  var output, address

  if (process.platform === 'darwin' || process.platform === 'linux') {
    try {
      output = cp.execSync(quote(['ifconfig', device]), { stdio: 'pipe' }).toString()
    } catch (err) {
      return null
    }

    address = MAC_ADDRESS_RE.exec(output)
    return address && normalize(address[0])
  } else if (process.platform === 'win32') {
    console.error('No windows support for this method yet - PR welcome!')
  }
}

/**
 * Sets the mac address for given `device` to `mac`.
 *
 * Device varies by platform:
 *   OS X, Linux: this is the interface name in ifconfig
 *   Windows: this is the network adapter name in ipconfig
 *
 * @param {string} device
 * @param {string} mac
 * @param {string=} port
 */
function setInterfaceMAC (device, mac, port) {
  if (!MAC_ADDRESS_RE.exec(mac)) {
    throw new Error(mac + ' is not a valid MAC address')
  }

  var isWirelessPort = port && port.toLowerCase() === 'wi-fi'

  if (process.platform === 'darwin') {
    if (isWirelessPort) {
      // Turn on the device, assuming it's an airport device.
      try {
        cp.execSync(quote(['networksetup', '-setairportpower', device, 'on']))
      } catch (err) {
        throw new Error('Unable to power on wifi device')
      }
    }

    // For some reason this seems to be required even when changing a non-airport device.
    try {
      cp.execSync(quote([PATH_TO_AIRPORT, '-z']))
    } catch (err) {
      throw new Error('Unable to disassociate from wifi networks')
    }

    // Change the MAC.
    try {
      cp.execSync(quote(['ifconfig', device, 'ether', mac]))
    } catch (err) {
      throw new Error('Unable to change MAC address')
    }

    // Restart airport so it will associate with known networks (if any)
    if (isWirelessPort) {
      try {
        cp.execSync(quote(['networksetup', '-setairportpower', device, 'off']))
        cp.execSync(quote(['networksetup', '-setairportpower', device, 'on']))
      } catch (err) {
        throw new Error('Unable to set restart wifi device')
      }
    }
  } else if (process.platform === 'linux') {
    // Set the device's mac address.
    // Handles shutting down and starting back up interface.
    try {
      cp.execSync(quote(['ifconfig', device, 'down', 'hw', 'ether', mac]))
      cp.execSync(quote(['ifconfig', device, 'up']))
    } catch (err) {
      throw new Error('Unable to change MAC address')
    }
  } else if (process.platform === 'win32') {
    // Locate adapter's registry and update network address (mac)
    var regKey = new Winreg({
      hive: Winreg.HKLM,
      key: WIN_REGISTRY_PATH
    })

    regKey.keys(function (err, keys) {
      if (err) {
        console.log('ERROR: ' + err)
      } else {
        // Loop over all available keys and find the right adapter
        for (var i = 0; i < keys.length; i++) {
          tryWindowsKey(keys[i].key, mac, device)
        }
      }
    })
  }
}

/**
 * Tries to set the "NetworkAddress" value on the specified registry key for given `device` to `mac`.
 *
 * @param {string} key
 * @param {string} device
 * @param {string} mac
 */
function tryWindowsKey (key, mac, device) {
  // Skip the Properties key to avoid problems with permissions
  if (key.indexOf('Properties') > -1) {
    return false
  }

  var networkAdapterKeyPath = new Winreg({
    hive: Winreg.HKLM,
    key: key
  })

  // we need to format the MAC a bit for Windows
  mac = mac.replace(/:/g, '')

  networkAdapterKeyPath.values(function (err, values) {
    var gotAdapter = false
    if (err) {
      console.log('ERROR: ' + err)
    } else {
      for (var x = 0; x < values.length; x++) {
        if (values[x].name === 'AdapterModel') {
          gotAdapter = true
          break
        }
      }

      if (gotAdapter) {
        networkAdapterKeyPath.set('NetworkAddress', 'REG_SZ', mac, function () {
          try {
            cp.execSync('netsh interface set interface "' + device + '" disable')
            cp.execSync('netsh interface set interface "' + device + '" enable')
          } catch (err) {
            throw new Error('Unable to restart device, is the cmd running as admin?')
          }
        })
      }
    }
  })
}

/**
 * Generates and returns a random MAC address.
 * @param  {boolean} localAdmin  locally administered address
 * @return {string}
 */
function randomize (localAdmin) {
  // Randomly assign a VM vendor's MAC address prefix, which should
  // decrease chance of colliding with existing device's addresses.

  var vendors = [
    [ 0x00, 0x05, 0x69 ], // VMware
    [ 0x00, 0x50, 0x56 ], // VMware
    [ 0x00, 0x0C, 0x29 ], // VMware
    [ 0x00, 0x16, 0x3E ], // Xen
    [ 0x00, 0x03, 0xFF ], // Microsoft Hyper-V, Virtual Server, Virtual PC
    [ 0x00, 0x1C, 0x42 ], // Parallels
    [ 0x00, 0x0F, 0x4B ], // Virtual Iron 4
    [ 0x08, 0x00, 0x27 ]  // Sun Virtual Box
  ]

  // Windows needs specific prefixes sometimes
  // http://www.wikihow.com/Change-a-Computer's-Mac-Address-in-Windows
  var windowsPrefixes = [
    'D2',
    'D6',
    'DA',
    'DE'
  ]

  var vendor = vendors[random(0, vendors.length - 1)]

  if (process.platform === 'win32') {
    vendor[0] = windowsPrefixes[random(0, 3)]
  }

  var mac = [
    vendor[0],
    vendor[1],
    vendor[2],
    random(0x00, 0x7f),
    random(0x00, 0xff),
    random(0x00, 0xff)
  ]

  if (localAdmin) {
    // Universally administered and locally administered addresses are
    // distinguished by setting the second least significant bit of the
    // most significant byte of the address. If the bit is 0, the address
    // is universally administered. If it is 1, the address is locally
    // administered. In the example address 02-00-00-00-00-01 the most
    // significant byte is 02h. The binary is 00000010 and the second
    // least significant bit is 1. Therefore, it is a locally administered
    // address.[3] The bit is 0 in all OUIs.
    mac[0] |= 2
  }

  return mac
    .map(function (byte) {
      return zeroFill(2, byte.toString(16))
    })
    .join(':').toUpperCase()
}

/**
 * Takes a MAC address in various formats:
 *
 *      - 00:00:00:00:00:00,
 *      - 00-00-00-00-00-00,
 *      - 0000.0000.0000
 *
 *  ... and returns it in the format 00:00:00:00:00:00.
 *
 * @param  {string} mac
 * @return {string}
 */
function normalize (mac) {
  var m = CISCO_MAC_ADDRESS_RE.exec(mac)
  if (m) {
    var halfwords = m.slice(1)
    mac = halfwords.map(function (halfword) {
      return zeroFill(4, halfword)
    }).join('')
    return chunk(mac, 2).join(':').toUpperCase()
  }

  m = MAC_ADDRESS_RE.exec(mac)
  if (m) {
    var bytes = m.slice(1)
    return bytes
      .map(function (byte) {
        return zeroFill(2, byte)
      })
      .join(':')
      .toUpperCase()
  }
}

function chunk (str, n) {
  var arr = []
  for (var i = 0; i < str.length; i += n) {
    arr.push(str.slice(i, i + n))
  }
  return arr
}

/**
 * Return a random integer between min and max (inclusive).
 * @param  {number} min
 * @param  {number=} max
 * @return {number}
 */
function random (min, max) {
  if (max == null) {
    max = min
    min = 0
  }
  return min + Math.floor(Math.random() * (max - min + 1))
}
