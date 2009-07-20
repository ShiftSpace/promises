window.addEvent('domready', runExamples);

/*
  The promise decorator will automatically wrap the Request in a Promise instance.
*/
var get = function(rsrc) 
{
  return new Request({
    method: 'get',
    url: 'data/'+rsrc+'.json'
  });
}.decorate(promise)

/*
  An adding function that can recieve promises.
*/
var add = function(a, b) 
{
  return a + b;
}.decorate(promise)

/*
  A logging function that can recieve promises.
*/
var show = function show(value, target)
{
  $(target).setProperty('value', value)
}.decorate(promise)


function example1()
{
  show(add(add(add(add(add(get('a'), get('b')), get('c')), get('d')), get('e')), get('f')), 'ex1'); // -> abcdef
}

// As long as you don't mutate promises directly
// you can use them as if they were regular JavaScript
// values!
function example2()
{
  var resources = ['a', 'b', 'c', 'd', 'e', 'f'];
  var result = "";
  while(resource = resources.shift())
  {
    result = add(result, get(resource));
  }
  show(result, 'ex2'); // -> abcdef
}

// What if you need to change the value of a promise?
function example3()
{
  var resources = ['a', 'b', 'c', 'd', 'e', 'f'];
  var result = "";
  while(resource = resources.shift())
  {
    var aPromise = get(resource);
    if(resources.length > 0) aPromise.op(function(value) { return value += ", " });
    result = add(result, aPromise);
  }
  show(result, 'ex3'); // -> "a, b, c, d, e, f"
}

function runExamples()
{
  example1();
  example2();
  example3();
}

