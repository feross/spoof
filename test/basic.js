var spoof = require('../')
var test = require('tape')


test('spoof.normalize()', function (t) {
  t.equal(spoof.normalize('00:00:00:00:00:00'), '00:00:00:00:00:00')
  t.equal(spoof.normalize('00-00-00-00-00-00'), '00:00:00:00:00:00')
  t.equal(spoof.normalize('0000.0000.0000'), '00:00:00:00:00:00')
  t.end()
})

test('spoof.random', function (t) {
  var mac = spoof.random()
  t.equal(mac, spoof.normalize(mac), 'returns valid, normalized mac addresses')
  t.end()
})