# spoof [![Build Status](https://img.shields.io/travis/feross/spoof.svg)](https://travis-ci.org/feross/spoof) [![npm](https://img.shields.io/npm/v/spoof.svg)](https://npmjs.org/package/spoof)

#### Easily spoof your MAC address in OS X & Linux!

![anonymous](https://raw.githubusercontent.com/feross/spoof/master/img/img.png)

Node.js port of the popular Python utility [SpoofMAC](https://pypi.python.org/pypi/SpoofMAC/) (GitHub: [feross/SpoofMAC](https://github.com/feross/SpoofMAC)).

### why?

I made this because changing your MAC address in OS X is harder than it should be. The Wi-Fi card needs to be manually disassociated from any connected networks in order for the change to apply correctly – super annoying! Doing this manually each time is tedious and lame.

Instead, just run `spoof` and change your MAC address in one command. Now for Linux, too!

### usage

**Requires Node 0.11+, because we need execSync.**

1. Install it globally.

  ```bash
  npm install -g spoof
  ```

2. Run it. Let's list all network interfaces!

  ```bash
  spoof list
  ```

You can always see up-to-date usage instructions by running `spoof --help`.

#### List available devices:

```bash
spoof list
- "Ethernet" on device "en0" with MAC address 70:56:51:BE:B3:00
- "Wi-Fi" on device "en1" with MAC address 70:56:51:BE:B3:01 currently set to 70:56:51:BE:B3:02
- "Bluetooth PAN" on device "en1"
```

#### List available devices, but only those on wifi:

```bash
spoof list --wifi
- "Wi-Fi" on device "en0" with MAC address 70:56:51:BE:B3:6F
```

#### Randomize MAC address *(requires root)*

You can use the hardware port name, such as:

```bash
spoof randomize wi-fi
```

or the device name, such as:

```bash
spoof randomize en0
```

#### Set device MAC address to something specific *(requires root)*

```bash
spoof set 00:00:00:00:00:00 en0
```

#### Reset device to its original MAC address *(requires root)*

While not always possible (because sometimes the original hardware MAC
isn't available), you can try setting the MAC address of a device back
to its burned-in address using `reset`:

```bash
spoof reset wi-fi
```

(older versions of OS X may call it "airport" instead of "wi-fi")

On OS X, another option to reset your MAC address is to simply restart your
computer. OS X doesn't preserve changes to your MAC address between restarts.

### windows support?

If you need Windows support, consider using the Python version of this program,
[SpoofMAC](https://github.com/feross/SpoofMAC). Or, please send a PR with Windows
support and I'll accept it. You can see how it's implemented in the Python version
[here](https://github.com/feross/SpoofMAC/blob/master/spoofmac/interface.py#L113).
Thanks!

### automatically set my MAC address on startup

If you want to set your MAC address and have it persist between restarts on
OS X, consider using the Python version of this program,
[SpoofMAC](https://github.com/feross/SpoofMAC), and following the instructions
for [running automatically on startup](https://github.com/feross/spoofmac#optional-run-automatically-at-startup).

## license

MIT. Copyright [Feross Aboukhadijeh](https://www.twitter.com/feross).
