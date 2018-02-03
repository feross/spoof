#!/usr/bin/env node

var chalk = require('chalk')
var minimist = require('minimist')
var spoof = require('../')
var { stripIndent } = require('common-tags')

var argv = minimist(process.argv.slice(2), {
  alias: {
    v: version
  }
})
var cmd = argv._[0]

try {
  init()
} catch (err) {
  console.error(chalk.red('Error:', err.message))
  process.exitCode = -1
}

function init () {
  if (cmd === 'version' || argv.version) {
    version()
  } else if (cmd === 'list' || cmd === 'ls') {
    list()
  } else if (cmd === 'set') {
    const mac = argv._[1]
    const devices = argv._.slice(2)
    set(mac, devices)
  } else if (cmd === 'randomize') {
    const devices = argv._.slice(1)
    randomize(devices)
  } else if (cmd === 'reset') {
    const devices = argv._.slice(1)
    reset(devices)
  } else if (cmd === 'normalize') {
    const mac = argv._[1]
    normalize(mac)
  } else {
    help()
  }
}

function help () {
  const message = stripIndent`
    spoof - Spoof your MAC address

    Example (randomize MAC address on macOS):
      spoof randomize en0

    Usage:
      spoof list [--wifi]                     List available devices.
      spoof set <mac> <devices>...            Set device MAC address.
      spoof randomize [--local] <devices>...  Set device MAC address randomly.
      spoof reset <devices>...                Reset device MAC address to default.
      spoof normalize <mac>                   Given a MAC address, normalize it.
      spoof help                              Shows this help message.
      spoof version | --version | -v          Show package version.

    Options:
      --wifi          Try to only show wireless interfaces.
      --local         Set the locally administered flag on randomized MACs.
  `
  console.log(message)
}

function version () {
  console.log(require('../package.json').version)
}

function set (mac, devices) {
  devices.forEach(function (device) {
    var it = spoof.findInterface(device)

    if (!it) {
      throw new Error('Could not find device for ' + device)
    }

    setMACAddress(it.device, mac, it.port)
  })
}

function normalize (mac) {
  console.log(spoof.normalize(mac))
}

function randomize (devices) {
  devices.forEach(function (device) {
    var it = spoof.findInterface(device)

    if (!it) {
      throw new Error('Could not find device for ' + device)
    }

    var mac = spoof.random(argv.local)
    setMACAddress(it.device, mac, it.port)
  })
}

function reset (devices) {
  devices.forEach(function (device) {
    var it = spoof.findInterface(device)

    if (!it) {
      throw new Error('Could not find device for ' + device)
    }

    if (!it.address) {
      throw new Error('Could not read hardware MAC address for ' + device)
    }

    setMACAddress(it.device, it.address, it.port)
  })
}

function list () {
  var targets = []
  if (argv.wifi) {
    targets.push('wi-fi')
  }

  var interfaces = spoof.findInterfaces(targets)

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
}

function setMACAddress (device, mac, port) {
  if (process.platform !== 'win32' && process.getuid() !== 0) {
    throw new Error('Must run as root (or using sudo) to change network settings')
  }

  spoof.setInterfaceMAC(device, mac, port)
}
