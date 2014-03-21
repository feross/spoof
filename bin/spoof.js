#!/usr/bin/env node

var chalk = require('chalk')
var minimist = require('minimist')
var spoof = require('../')

var argv = minimist(process.argv.slice(2))
var cmd = argv._[0]

if (argv.v || argv.version) {

  console.log(require('../package.json').version)

} else if (cmd === 'list' || cmd === 'ls') {

  var targets = []
  if (argv.wifi) {
    targets = spoof.WIRELESS_PORT_NAMES
  }

  var interfaces
  try {
    interfaces = spoof.findInterfaces(targets)
  } catch (err) {
    error(err)
  }

  interfaces.forEach(function (it) {
    var line = []
    line.push('-', chalk.bold.green(it.port), 'on device', chalk.bold.green(it.device))
    if (it.address) {
      line.push('with MAC address', chalk.bold.cyan(it.address))
    }
    if (it.currentAddress && it.currentAddress !== it.address) {
      line.push('currently set to', chalk.bold.red(it.currentAddress))
    }
    console.log(line.join(' '))
  })

} else if (cmd === 'set') {

  var mac = argv._[1]
  var devices = argv._.slice(2)

  devices.forEach(function (device) {
    var it
    try {
      it = spoof.findInterface(device)
    } catch (err) {
      error(err)
    }

    if (!it) {
      error(new Error('Could not find device for ' + device))
    }

    setMACAddress(it.device, mac, it.port)
  })

} else if (cmd === 'randomize') {

  var devices = argv._.slice(1)
  devices.forEach(function (device) {
    var it
    try {
      it = spoof.findInterface(device)
    } catch (err) {
      error(err)
    }

    if (!it) {
      error(new Error('Could not find device for ' + device))
    }

    var mac = spoof.randomMAC(argv.local)
    setMACAddress(it.device, mac, it.port)
  })

} else if (cmd === 'reset') {

  var devices = argv._.slice(1)
  devices.forEach(function (device) {
    var it
    try {
      it = spoof.findInterface(device)
    } catch (err) {
      error(err)
    }

    if (!it) {
      error(new Error('Could not find device for ' + device))
    }

    if (!it.address) {
      error(new Error('Could not read hardware MAC address for ' + device))
    }

    setMACAddress(it.device, it.address, it.port)
  })

} else if (cmd === 'normalize') {

  var mac = argv._[1]
  console.log(spoof.normalizeMAC(mac))

} else {

  console.log(
    'SpoofMAC - Easily spoof your MAC address in OS X, Windows & Linux\n\n' +
    'Usage:\n\n' +
    '  spoof list [--wifi]                     List available devices.\n' +
    '  spoof set <mac> <devices>...            Set device MAC address.\n' +
    '  spoof randomize [--local] <devices>...  Set device MAC address randomly.\n' +
    '  spoof reset <devices>...                Reset device MAC address to default.\n' +
    '  spoof normalize <mac>                   Given a MAC address, normalize it.\n' +
    '  spoof --help | -h                       Shows this help message.\n' +
    '  spoof --version | -v                    Show package version.\n\n' +
    'Options:\n\n' +
    '  --wifi          Try to only show wireless interfaces.\n' +
    '  --local         Set the locally administered flag on randomized MACs.\n'
  )

}

function setMACAddress (device, mac, port) {
  if (process.platform !== 'win32' && process.getuid() !== 0) {
    error(new Error('Must run as root (or using sudo) to change network settings'))
  }

  try {
    spoof.setInterfaceMAC(device, mac, port)
  } catch (err) {
    error(err)
  }
}

/**
 * Print error and terminate the program
 * @param  {Error} err
 */
function error (err) {
  console.error(chalk.red('Error:', err.message))
  process.exit(-1)
}
