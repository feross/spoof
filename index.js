var cp = require('child_process')
var quote = require('shell-quote').quote

// Path to Airport binary on 10.7, 10.8, and 10.9 (might be different on older OS X)
var PATH_TO_AIRPORT = '/System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport'

// Regex to validate a MAC address
// Example: 00-00-00-00-00-00 or 00:00:00:00:00:00 or 000000000000
var MAC_ADDRESS_RE = /([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})[:-]?([0-9A-F]{1,2})/i

// Regex to validate a MAC address in cisco-style
// Example: 0123.4567.89ab
var CISCO_MAC_ADDRESS_RE = /([0-9A-F]{,4})\.([0-9A-F]{,4})\.([0-9A-F]{,4})/i

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

  // Parse the output of `networksetup -listallhardwareports` which gives
  // us 3 fields per port:
  // - the port name,
  // - the device associated with this port, if any,
  // - the MAC address, if any, otherwise 'N/A'
  var output
  try {
    output = cp.execSync('networksetup -listallhardwareports').toString()
  } catch (err) {
    throw err
  }
  var details = []
  while (true) {
    var result = /(?:Hardware Port|Device|Ethernet Address): (.+)/.exec(output)
    if (!result || !result[1]) {
      break
    }
    details.push(result[1])
    output = output.slice(result.index + result[1].length)
  }

  var interfaces = []; // to return

  // Split the results into chunks of 3 (for our three fields) and yield
  // those that match `targets`.
  for (var i = 0; i < details.length; i += 3) {
    var port = details[i]
    var device = details[i + 1]
    var address = details[i + 2]

    address = MAC_ADDRESS_RE.exec(address.toUpperCase())
    if (address) {
      address = address[0]
    }

    var it = {
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

    for (var j = 0; j < targets.length; j++) {
      var target = targets[j]
      if (target === port.toLowerCase() || target === device.toLowerCase()) {
        interfaces.push(it)
        break
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
  var output
  try {
    output = cp.execSync(quote(['ifconfig', device]), { stdio: 'pipe' }).toString()
  } catch (err) {
    return null
  }

  var address = MAC_ADDRESS_RE.exec(output.toUpperCase())
  return address && address[0]
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
  if (port && port.toLowerCase().indexOf(WIRELESS_PORT_NAMES) >= 0) {
    // Turn on the device, assuming it's an airport device.
    try {
      cp.execSync(quote(['networksetup', '-setairportpower', device, 'on']))
    } catch (err) {
      throw new Error('Error powering on wifi device')
    }
  }

  // For some reason this seems to be required even when changing a non-airport device.
  try {
    cp.execSync(quote([PATH_TO_AIRPORT, '-z']))
  } catch (err) {
    throw new Error('Error disassociating from wifi networks')
  }

  // Change the MAC.
  try {
    cp.execSync(quote(['ifconfig', device, 'ether', mac]))
  } catch (err) {
    throw new Error('Error changing MAC address')
  }

  // Associate airport with known network (if any)
  try {
    cp.execSync('networksetup -detectnewhardware')
  } catch (err) {
    throw new Error('Error associating with known networks')
  }
}

