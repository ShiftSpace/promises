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


var show = function(value)
{
  console.log("show: " + value);
}.decorate(promise)


function init()
{
  show(myAdd(myAdd(get('a'), get('b')), myAdd(get('d'), get('c'))));
}