window.addEvent('domready', init);

var get = function(rsrc) 
{
  return new Request({
    method: 'get',
    url: rsrc+'.json'
  });
}.decorate(promise)


var addFn = function(a, b) 
{
  return a + b;
}.decorate(promise)


var fnA = function(v)
{
  var p = get('c');
  return p.op(function(value) { return value.toUpperCase() + v; });
}.decorate(promise)


var fnB = function(a, b)
{
  var p = get(b);
  return p.op(function(value) { return a + value; });
}.decorate(promise)


var show = function show(arg)
{
  console.log('show: ' + arg);
}.decorate(promise)

var debug;
function init()
{
  var p1 = addFn(addFn(get('a'), get('b')), addFn(get('d'), fnA(get('f')))); // abdCf promise
  var p2 = fnB(fnB(fnB(fnB(fnB(get('a'), 'b'), 'c'), 'd'), 'e'), 'f'); // abcdef promise
  var p3 = get('a');
  var p4 = addFn(addFn(get('b'), p3), addFn(get('c'), p3));
  
  show(addFn(addFn(p1, " "), p2)); // abdCf abcdef, probably print last, has to wait on two promises
  show("Aren't promises neat?"); // will probably print first
  show(p4);
  
  p1.addEvent('realized', function(v) { // will probably print second
    show(v);
    p1.op(function(value) { return value + 'foo'; }); // not a good idea to change a promise if it's already been passed to other functions.
    show(p1);
  });
}