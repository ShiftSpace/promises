window.addEvent('domready', init);


var get = function(rsrc) 
{
  return new Request({
    method: 'get',
    url: rsrc+'.json'
  });
}.decorate(promise)


var myAdd = function(a, b) 
{
  return a + b;
}.decorate(promise);


var myFn = function()
{
  var p1 = getA();
  p1.op(function(value) { return value + " "; });
  var p2 = getB();
  return myAdd(p1, p2);
}.decorate(promise)


var show = function(arg1, arg2, arg3)
{
  console.log('show ----------');
  console.log("arg1: " + arg1);
  console.log("arg2: " + arg2);
  console.log("arg3: " + arg3);
  console.log('---------------');
}.decorate(promise)


function init()
{
  show(1, myAdd(myAdd(get('a'), get('b')), myAdd(get('d'), get('c'))), 2);
}