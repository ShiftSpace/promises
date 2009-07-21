/*
  Promises version 0.1
  
  An implementation of promises for MooTools:
  http://en.wikipedia.org/wiki/Futures_and_promises
*/

// we need a backreference to wrapper
Class.extend({
  wrap: function(self, key, method)
  {
    if (method._origin) method = method._origin;

    var wrapper = function(){
      if (method._protected && this._current == null) throw new Error('The method "' + key + '" cannot be called.');
      var caller = this.caller, current = this._current;
      this.caller = current; this._current = arguments.callee;
      var result = method.apply(this, arguments);
      this._current = current; this.caller = caller;
      return result;
    }.extend({_owner: self, _origin: method, _name: key});

    method._wrapper = wrapper;
    return wrapper;
  }
});


Array.implement({
  drop: function(n) 
  {
    return this.slice(n, this.length);
  }
});


Function.implement({
  decorate: function()
  {
    var decorators = $A(arguments);
    var resultFn = this;
    var decorator;
    
    while(decorator = decorators.pop())
    {
      resultFn = decorator(resultFn);
    }
    
    return resultFn;
  },
  
  rewind: function(bind, args)
  {
    return this._wrapper.bind(bind, args);
  }
});


function $msg(methodName) 
{
  var rest = $A(arguments).drop(1);
  return function(obj) {
    return obj[methodName].apply(obj, rest);
  };
}

/*
  Class: Promise
    You can create empty Promise instances, Promises from unsent Request instances
    or from an array of values containing promises.
    
    new Promise();
    new Promise(new Request({url:'bar.html'}));
    new Promise(["foo", new Promise(new Request({url:'bar.html'})), "baz"]);
    
    Please note that you should not initialize Promise with a Request which has already 
    been sent.
*/
var Promise = new Class({

  Implements: [Events, Options],
  name: "Promise",
  
  defaults:
  {
    lazy: true,
    reduce: null
  },
  
  initialize: function(value, options)
  {
    this.setOptions(this.defaults, options);
    
    this.__realized = false;
    this.__ops = [];
    
    if(value && value.xhr)
    {
      this.initReq(value);
    }
    else if(value && $type(value) == "array")
    {
      Promise.watch(value, function(promises) {
        var values = promises.map(Promise.getValue);
        var result = (this.options.reduce && this.options.reduce.apply(null, values)) || values;
        this.setValue(result);
      }.bind(this));
    }
    else if(value)
    {
      throw new Error("You can only create empty Promises, Promises from Request objects or from an array of values containing Promise instances.");
    }
  },

  
  initReq: function(req)
  {
    this.__req = req;
    req.addEvent('onSuccess', function(responseText) {
      this.setValue(this.applyOps(JSON.decode(responseText).data));
    }.bind(this));
    req.addEvent('onFailure', function(responseText) {
      this.fireEvent('error', this);
    }.bind(this));
    if(!this.options.lazy) req.send();
  },
  
  
  realize: function()
  {
    if(this.__req) this.__req.send();
  },
  
  
  applyOps: function(value)
  {
    var aop = this.__ops.shift();
    while(aop) {
      value = aop(value);
      aop = this.__ops.shift();
    }
    return value;
  },
  
  /*
    Method: op
      You can modify the value of unrealized Promise with op. If the Promise
      is unrealized, the return value will be the Promise itself. If already
      realized, the return value will be value of the Promise after the operation
      has been applied.
  */
  op: function(fn)
  {
    if(!this.__realized)
    {
      this.__ops.push(fn);
    }
    else
    {
      this.setValue(fn(this.__value));
    }
    if(!this.__realized) return this;
    return this.value();
  },
  
  
  hasOps: function()
  {
    return this.__ops.length > 0;
  },
  
  
  setValue: function(value)
  {
    if(!value) return;
    
    if(value.xhr)
    {
      this.initReq(value);
    }
    else
    {
      this.__value = value
      
      if(!this.__realized)
      {
        this.__realized = true;
        this.fireEvent('realized', this.__value);
      }
    }
  },
  
  
  value: function()
  {
     if(this.hasOps()) this.__value = this.applyOps(this.__value);
     return this.__value;
  },
  
  
  isRealized: function()
  {
    return this.__realized;
  },
  
  
  isNotRealized: function()
  {
    return !this.__realized;
  }
});


Promise.isPromise = function(obj)
{
  return (obj && obj.name == "Promise");
}


Promise.getValue = function(v)
{
  while (Promise.isPromise(v) && v.isRealized())
  {
    v = v.value();
  }
  return v;
}

/*
  Function: Promise.toValues
    Map an array of values to only non-Promise values or
    unrealized Promise values.
*/
Promise.toValues = function(ary)
{
  while(ary.some(Promise.isPromise))
  {
    ary = ary.map(Promise.getValue);
  }
  return ary;
}

/*
  Function: Promise.promiseOrValue
    If v is a Request object returns a promise, otherwise
    just the value.
*/
Promise.promiseOrValue = function(v)
{
  if(v && v.xhr)
  {
    return new Promise(v);
  }
  return v;
}

/*
  Function: Promise.watch
    Watch an array of values containing unrealized promises.
    This will not call the callback until there no unrealized
    promises left. This means if the value of a Promise is
    another Promise which is not realized, Promise.watch will simply
    Promise.watch the values again.
    
  Parametes:
    args - an array of values, can contain Promise instances realized or unrealized.
    cb - a function callback.
    errCb - a error callback.
*/
Promise.watch = function(args, cb, errCb)
{
  var promises = args.filter(Promise.isPromise);
  var unrealized = promises.filter($msg("isNotRealized"));
  
  if(unrealized.length > 0)
  {
    var watching = new Group(unrealized);
  
    watching.addEvent('realized', function() {
      args = args.map(Promise.getValue);
      if(!Promise.allRealized(args))
      {
        Promise.watch(args, cb);
      }
      else
      {
        cb(Promise.toValues(args));
      }
    });
    
    if(errCb)
    {
      unrealized.each(function(aPromise) {
        aPromise.addEvent('error', errCb.bind(null, [aPromise]));
      });
    }
    
    unrealized.each($msg('realize'));
  }
  else
  {
    cb(Promise.toValues(args))
  }
}


Promise.allRealized = function(vs)
{
  return vs.filter(Promise.isPromise).every($msg("isRealized"));
}

/*
  Function: promise
    The promise decorator. Takes a function and returns a new function that
    can handle Promises as arguments. If this new function recieves any Promises
    it will continue to block until it can convert all of it's arguments to 
    non-Promise values.
*/
function promise(fn) 
{
  return function decorator() {
    var args = $A(arguments);

    var promises = args.filter(Promise.isPromise);
    var unrealized = promises.filter($msg('isNotRealized'));
    
    if(unrealized.length > 0)
    {
      var p = new Promise();
      
      Promise.watch(
        args, 
        function(realized) 
        {
          var temp = this._current;
          this._current = decorator._wrapper;
          p.setValue(fn.apply(this, realized));
          this._current = temp;
        }.bind(this), 
        function(errPromise)
        {
          var err = new Error("Failed to realize promise from " + errPromise.__req.options.url);
          err.promise = errPromise;
          err.source = fn.toSource();
          err.sourceArgs = args;
          throw err;
        }.bind(this));

      return p;
    }
    else
    {
      var porv = Promise.promiseOrValue(fn.apply(this, args.map(Promise.getValue)));
      return porv;
    }
  }
}