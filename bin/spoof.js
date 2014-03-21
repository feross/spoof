#!/usr/bin/env node

var chalk = require('chalk')
var minimist = require('minimist')
var spoof = require('../')

var argv = minimist(process.argv.slice(2))

if (argv._.length === 0 || argv.h || argv.help) {

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

} else if (argv._[0] === 'list') {

  var targets = []
  if (argv.wifi) {
    targets.push.apply(targets, spoof.WIRELESS_PORT_NAMES)
  }

  try {
    spoof.findInterfaces(targets).forEach(function (it) {
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
  } catch (err) {
    error(err)
  }

} else if (argv._[0] === 'set') {

}

function error (err) {
  console.error(err.message)
  process.exit(-1)
}

// console.log(spoof.getInterfaceMAC('en0'))