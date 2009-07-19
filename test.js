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
  console.log(arg);
}.decorate(promise)


function init()
{
  var p1 = addFn(addFn(get('a'), get('b')), addFn(get('d'), fnA(get('f')))); // abdCf promise
  var p2 = fnB(fnB(fnB(fnB(fnB(get('a'), 'b'), 'c'), 'd'), 'e'), 'f'); // abcdef promise
  
  show(addFn(addFn(p1, " "), p2)); // abdCf abcdef
  show("Aren't promises neat?"); // throws an error
}