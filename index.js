var cp = require('child_process')
var quote = require('shell-quote').quote
var zeroFill = require('zero-fill')

// Path to Airport binary on 10.7, 10.8, and 10.9 (might be different on older OS X)
var PATH_TO_AIRPORT = '/System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport'

// Regex to validate a MAC address
// Example: 00-00-00-00-00-00 or 00:00:00:00:00:00 or 000000000000
var MAC_ADDRESS_RE = /([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})/i

// Regex to validate a MAC address in cisco-style
// Example: 0123.4567.89ab
var CISCO_MAC_ADDRESS_RE = /([0-9A-F]{0,4})\.([0-9A-F]{0,4})\.([0-9A-F]{0,4})/i

// The possible port names for wireless devices as returned by networksetup.
var WIRELESS_PORT_NAMES = ['wi-fi', 'airport']
exports.WIRELESS_PORT_NAMES = WIRELESS_PORT_NAMES

/**
 * Returns the list of interfaces found on this machine as reported by the
 * `networksetup` command.
 * @param {Array.<string>|null} targets
 * @return {Array.<Object>)}
 */
exports.findInterfaces = function (targets) {
  targets = targets || []

  targets = targets.map(function (target) {
    return target.toLowerCase()
  })

  var output, interfaces, details, result, i, port, device, address, it, j, target

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
        address = exports.normalize(address[0])
      }

      it = {
        address: address,
        currentAddress: exports.getInterfaceMAC(device),
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
        address = exports.normalize(address)
      }

      it = {
        address: address,
        currentAddress: exports.getInterfaceMAC(device),
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

  } else if (process.platform === 'windows') {

  }

  return interfaces
}

/**
 * Returns the first interface which matches `target`
 * @param  {string} target
 * @return {Object}
 */
exports.findInterface = function (target) {
  var interfaces = exports.findInterfaces([target])
  return interfaces && interfaces[0]
}

/**
 * Returns currently-set MAC address of given interface. This is distinct from the
 * interface's hardware MAC address.
 * @return {string}
 */
exports.getInterfaceMAC = function (device) {
  var output, address

  if (process.platform === 'darwin' || process.platform === 'linux') {

    try {
      output = cp.execSync(quote(['ifconfig', device]), { stdio: 'pipe' }).toString()
    } catch (err) {
      return null
    }

    address = MAC_ADDRESS_RE.exec(output)
    return address && exports.normalize(address[0])

  } else if (process.platform === 'windows') {

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
exports.setInterfaceMAC = function (device, mac, port) {
  if (!MAC_ADDRESS_RE.exec(mac)) {
    throw new Error(mac + ' is not a valid MAC address')
  }

  if (process.platform === 'darwin') {

    if (port && port.toLowerCase().indexOf(WIRELESS_PORT_NAMES) >= 0) {
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

    // Associate airport with known network (if any)
    // Note: This does not work on OS X 10.9 due to changes in the Airport utility
    try {
      cp.execSync('networksetup -detectnewhardware')
    } catch (err) {
      throw new Error('Unable to associate with known networks')
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

  }
}

/**
 * Generates and returns a random MAC address.
 * @param  {boolean} localAdmin  locally administered address
 * @return {string}
 */
exports.random = function (localAdmin) {
  // By default use a random address in VMWare's MAC address
  // range used by VMWare VMs, which has a very slim chance of colliding
  // with existing devices.
  var mac = [
    0x00,
    0x05,
    0x69,
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
      return zeroFill(byte.toString(16), 2)
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
exports.normalize = function (mac) {
  var m = CISCO_MAC_ADDRESS_RE.exec(mac)
  if (m) {
    var halfwords = m.slice(1)
    mac = halfwords.map(function (halfword) {
      return zeroFill(halfword, 4)
    }).join('')
    return chunk(mac, 2).join(':').toUpperCase()
  }

  m = MAC_ADDRESS_RE.exec(mac)
  if (m) {
    var bytes = m.slice(1)
    return bytes
      .map(function (byte) {
        return zeroFill(byte, 2)
      })
      .join(':')
      .toUpperCase()
  }

  // return None
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
