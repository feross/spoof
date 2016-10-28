#!/usr/bin/env node

var chalk = require('chalk')
var minimist = require('minimist')
var spoof = require('../')

var argv = minimist(process.argv.slice(2))
var cmd = argv._[0]

if (argv.v || argv.version) {
  console.log(require('../package.json').version)
  process.exit(0)
}

if (cmd === 'list' || cmd === 'ls') {
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
  process.exit(0)
}

var devices, mac
if (cmd === 'set') {
  mac = argv._[1]
  devices = argv._.slice(2)

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
  process.exit(0)
}

if (cmd === 'randomize') {
  devices = argv._.slice(1)
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

    var mac = spoof.random(argv.local)
    setMACAddress(it.device, mac, it.port)
  })
  process.exit(0)
}

if (cmd === 'reset') {
  devices = argv._.slice(1)
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
  process.exit(9)
}

if (cmd === 'rotate') {
  try {
    interfaces = spoof.findInterfaces(targets)
  } catch (err) {
    error(err)
  }

  interfaces.forEach(function (i) {
    if (i.currentAddress && i.currentAddress !== i.address) {
      var mac = spoof.random(argv.local)
      setMACAddress(i.device, mac, i.port)
      console.log('Rotating MAC for ' + i.device)
    }
  })
  process.exit(0)
}

if (cmd === 'normalize') {
  mac = argv._[1]
  console.log(spoof.normalize(mac))
  process.exit(0)
}

printHelp()

function printHelp () {
  console.log('SpoofMAC - Easily spoof your MAC address in OS X & Linux')
  console.log('')
  console.log('Usage:')
  console.log('  spoof list [--wifi]                     List available devices.')
  console.log('  spoof set <mac> <devices>...            Set device MAC address.')
  console.log('  spoof randomize [--local] <devices>...  Set device MAC address randomly.')
  console.log('  spoof rotate                            Reset all set previously set addresses randomly.')
  console.log('  spoof reset <devices>...                Reset device MAC address to default.')
  console.log('  spoof normalize <mac>                   Given a MAC address, normalize it.')
  console.log('  spoof --help | -h                       Shows this help message.')
  console.log('  spoof --version | -v                    Show package version.')
  console.log('')
  console.log('Options:')
  console.log('  --wifi          Try to only show wireless interfaces.')
  console.log('  --local         Set the locally administered flag on randomized MACs.')
  console.log('')
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
