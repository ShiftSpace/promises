Rationale
================================================================================

Dealing with asynchronous requests in a large AJAX application can be
quite a task and try as you might it often introduces spaghetti code
in the form of complex callback logic. But asynchronous requests are
even more nefarious in that they force users who wish to extend your
code to also have to provide a callback in their interface! For
example:

  function displayFoo(value, callback)
  {
    ... some code ...
  }

Now in order to extend this function with same functionality and make
it extendable for others, you have to do something like the following:

  function displayBar(value, callback)
  {
    ... some custom code ...
    displayFoo(value, callback);
  }

In large application you get an explosion of callbacks. For the next
example let's look at a common pattern in AJAX applications.

  function bar()
  {
    getFoo({... params ...}, handleFoo);
  }

  function handleFoo(response)
  {
    doSomething(response);
  }

Now AJAX programmers have simply gotten used to this pattern but
what's happened here is not desirable. We've broken out the logic of
handleFoo not because we want to, but because we want to maintain
readability. This is also not composable. That is you cannot change
the behavior of the result of the aysynchronous call by composing some
functions together. You have to put any new logic into handleFoo.
We'll see the implications of this at the end.

Let's look at how you write JavaScript when you're not dealing with
asynchronous calls. If it wasn't for the callback we would have
written something like the following:

  function bar()
  {
    var result = getFoo({... params ...});
    doSomething(result);
  }

Guess what? Promises allow you do exactly this! What does it look like?

  function bar()
  {
    var promise = getFoo({... params ...});
    doSomething(promise);
  }

Really? The only thing you have to understand when using promises is
whether a function will return an unrealized value or will need to
accept an unrealized value. If you think that a function will need
to be used in this way you decorate it with promise like so.

  var getFoo = function()
  {
    ... some code ...
  }.decorate(promise)

The promise decorator does a couple of fancy things. 

First, of all it doesn't change the behavior of the function. You can
pass normal arguments to this function and it will work just fine.

Second, if any the arguments to getFoo are unrealized Promise
instances it will block. getFoo will only execute when all those
Promises instances have realized their values (sweet isn't it?). This
works even if the values of the Promises themselves are unrealized
promises!

Third, if the result of a promise decorated function is a MooTools
request object it will automatically create a promise and return that.

  var getFoo = function()
  {
    return new Request({
      url: 'foo.json',
      method: 'get'
    });
  }.decorate(promise)

Hmm, this sounds good but when writing code you often want to
manipulate the result of a function. How can you do that with
Promises? For example in code we often write something like
the following:

  function bar()
  {
    var result = getFoo();
    result = result + 5;
  }

With Promises you can accomplish the same thing with:

  function bar()
  {
    var p = getFoo();
    p.op(function(v) {return v+5});
  }

A little more typing here, but let's see how much typing Promises
really save in non-trivial applications.  Let's demonstrate something
that's difficult to do without promises. For example say we want
values of 6 different remote resources and we want to add them
together. With promises it will look something like this.

  var get = function(rsrc) 
  {
    return new Request({
      method: 'get',
      url: rsrc+'.json'
    });
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

  show(fnB(fnB(fnB(fnB(fnB(get('a'), 'b'), 'c'), 'd'), 'e'), 'f'))

Notice we have no callbacks. When we run this code will print "abcdef"
to JavaScript console. In traditional AJAX programming there is just
no way to express the above succintly or in a composable manner. What
you have to do looks something like the following.

  function get(rsrc, callback) 
  {
    new Request({
      method: 'get',
      url: rsrc+'.json',
      onComplete: callback
    }).send();
  }

  function show(arg)
  {
    console.log(arg);
  }

  var result = '';
  get('a', function(response) {
    result += JSON.decode(response).data;
    get('b', function(response) {
      result += JSON.decode(response).data;
      get('c', function(response) {
        result += JSON.decode(response).data;
        get('d', function(response) {
          result += JSON.decode(response).data;
          get('e', function(response) {
            result += JSON.decode(response).data;
            get('f', function(response) {
              result += JSON.decode(response).data;
              show(result);
            });
          });
        });
      });
    });
  });
				   
