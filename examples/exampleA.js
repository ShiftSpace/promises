window.addEvent('domready', runExamples);

//Promise.debug = true;

/*
  The promise decorator will automatically wrap the Request in a Promise instance.
*/
var get = function(rsrc) 
{
  return new Request({
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
  if(target)
  {
    $(target).setProperty('value', value)
  }
  else
  {
    console.log("show: " + value);
  }
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

// short cut (For Avital)
function example4()
{
  var subtract = function(a, b) { return a - b; }.asPromise();
  show(subtract(get("10"), get("7")), "ex4");
}

// if you attempt to creata promise from a resource that doesn't exist
// you'll get an exception, in order to help with debugging the error
// will contain the source of the function that causes the error as well
// as the arguments that were passed to that function.
function example5()
{
  var result = add(add(add(add(add(get('a'), get('b')), get('c')), get('d')), get('e')), get('z'));
}

// A relatively useful pattern for loading lazy resources - a singleton resource as it were
var example6 = function()
{
  return get("a");
}.decorate(promise, memoize);

// Preconditions
// =============
function even(n)
{
  return (n % 2) == 0;
}

function odd(n)
{
  return !even(n);
}

// conditions are just an array of functions that will
// be used with the respective argument.
var evenOdd = [even, odd];
var oddEven = [odd, even];

// pre(evenOdd, true), we want to check that the first argument
// is even, the second odd, and we want exceptions if this is not
// fulfilled
var add2 = function(a, b)
{
  return a + b;
}.decorate(promise, pre(evenOdd, true))

var add3 = function(a, b)
{
  return a + b;
}.decorate(promise, pre(evenOdd, console.log))

function example7()
{
  show(add2(get("10"), add2(get("10"), get("7")))); // works
  show(add2(get("7"), add2(get("10"), get("7")))); // will fail with exception
}

// $if
var foo;
function example8()
{
  foo = $if(get("true"),
            add.bind(null, [get("10"), get("7")]),
            null);
  show(foo);
}

// Promises with regular values
function example9()
{
  var x = function(x) { return x * 2; }.asPromise();
  var p1 = new Promise(5);
  var p2 = x(p1);
  show(p2);
  p1.realize();
}

function example10()
{
  var x = function(a, b) { return a * b; }.asPromise();
  var p1 = $promise(3);
  var p2 = $promise(4);
  var p3 = x(p1, p2);
  show(p3);
  p1.realize();
  p2.realize();
}

// Run Examples
// ============
function runExamples()
{
  console.log(">>>>>>>>>>>>>>>>>>>> ENTER runExamples");
  example1();
  example2();
  example3();
  example4();
  example5();
  
  // the following will only generate a single request yet print three times to the console
  show(example6());
  show(example6());
  show(example6());
  
  example7();
  example8();
  example9();
  example10();
  console.log(">>>>>>>>>>>>>>>>>>>> runExamples");
}

