// ==Builder==
// @required
// @package           Promises
// ==/Builder==

/*
  Promises version 0.8
  
  An implementation of promises for MooTools:
  http://en.wikipedia.org/wiki/Futures_and_promises
*/

Function.implement({
  future: function() { return this.decorate(promise); }
});

/*
  Class: Promise
    You can create empty Promise instances, Promises from unsent Request 
    instances or from an array of values containing promises.
    
    new Promise();
    new Promise(new Request({url:'bar.html'}));
    new Promise(["foo", new Promise(new Request({url:'bar.html'})), "baz"]);
    
    Please note that you should not initialize Promise with a Request which 
    has already been sent.
    
  Options:
    lazy - The promise is treated as a lazy value. It only trigger a
      realized event when deliver is called on it. Defaults to false.
    reduce - A function. Convenience when a promise wraps an array of
      promises. The function should take an array and return a single value.
    bare - Useful when using promises to load files. Otherwise a promise
      expects values from the server to be in the form {"data": ...}. Defaults
      to false.
    meta - Store some metadata about the promise. Useful fo debugging.
    plain - The promise is a plain value. That is it is not a request. Not
      intended to be used directly.
    async - Make the promise realize synchronously. Defaults to false.
*/
var Promise = new Class({

  Implements: [Events, Options],
  name: "Promise",
  
  defaults: {
    lazy: false,
    reduce: null,
    bare: false,
    meta: null,
    plain: false,
    async: true
  },
  
  initialize: function(value, options) {
    this.setOptions(this.defaults, options);
    
    this.__realized = false;
    this.__ops = [];
    this.__plain = this.options.plain;
    this.__async = this.options.async;
    
    if(this.options.meta) this.setMeta(this.options.meta);
    
    // if handed a Request object initialize it
    if(value && value.xhr) {
      this.initReq(value);
    } else if(value && value.name == "DelayedAsset") {
      this.initDelayedAsset(value);
    } else if(value && $type(value) == "array") {
      // if handed an array look for promises and watch them.
      // watch is not lazy, triggers realize, might want to change this
      // David 11/16/2009
      Promise.watch(value, function(promises) {
        var values = promises.map(Promise.getValue);
        var result = (this.options.reduce && this.options.reduce.apply(null, values)) || values;
        this.deliver(result);
      }.bind(this));
    } else if(value && 
              !Promise.isPromise(value) && 
              $type(value) == "object" && 
              $H(value).getValues().some(Promise.isPromise)) {
      // if handed an object look for promises in the values - not recursive
      Promise.watch($H(value).getValues(), function(promises) {
        this.deliver($H(value).map(Promise.getValue).getClean());
      }.bind(this));
    } else if(Promise.isPromise(value)) {
      // if handed a promise, watch it
      this.__promise = value;
      value.addEvent('realized', function() {
        this.deliver(value.value());
      }.bind(this));
    } else if(typeof value != 'undefined') {
      // if handed a regular value, set the value immediately but don't
      // trigger a realized event. 
      this.__plain = true;
      this.deliver(value, false);
    } else if(typeof value == 'undefined') {
      this.__plain = true;
      this.options.lazy = true;
    }
    
    return this;
  },
  
  /*
    Function: setMeta
      *private*
      Private setter for metadata.
      
    Parameters:
      meta - any value.
  */
  setMeta: function(meta) { this.__meta = meta; },
  
  /*
    Function: meta
      Returns the metadata for this promise.
      
    Returns:
      A value.
  */
  meta: function() { return this.__meta; },
  
  /*
    Function: initReq
      *private*
      Initialize the request. If successfull calls deliver with the value
      received from the server after applying all operations on the value
      first. On request failure, delivers to undefined and fires an error
      event passing itself as data.
    
    Parameters:
      req - MooTools Request object.
  */
  initReq: function(req) {
    this.__req = req;
    req.addEvent('onSuccess', function(responseText) {
      var json = (!req.options.bare) ? JSON.decode(responseText) : responseText,
          v = (Promise.deref !== null && json[Promise.deref] !== null && json[Promise.deref] !== undefined) ? json[Promise.deref] : json;
      this.deliver(this.applyOps(v));
    }.bind(this));
    req.addEvent('onFailure', function(responseText) {
      this.deliver(undefined);
      this.fireEvent('error', this);
    }.bind(this));
  },


  initDelayedAsset: function(asset) {
    this.__asset = asset;
    asset.addEvent('onload', function() {
      this.deliver(true);
    }.bind(this));
  },

  
  /*
    Function: setAsync
      *private*
      Private setter for async flag.
  */
  setAsync: function(val) {
    this.__async = val;
  },
  
  /*
    Function: isAsync
      *private*
      Private getter for async flag.
  */
  isAsync: function() {
    return this.__async;
  },
  
  /*
    Function: realize
      Realize the value of the promise. If the promise is a request, sends
      the request. If Promise.debug == true or the async option is set to
      false the request will be made synchronously. If the value is plain
      simply calls deliver with the current value of the promise.
  */
  realize: function() {
    if(this.__req && !this.__realizing) {
      this.__realizing = true;
      if(Promise.debug || !this.isAsync()) this.__req.options.async = false;
      this.__req.send();
    } else if(this.__asset && !this.__realizing) {
      this.__realizing = true;
      this.__asset.load();
    } else if(this.__plain) {
      this.deliver(this.value());
    } else if(this.__promise) {
      if(this.__promise.isRealized())
      {
        this.deliver(this.__promise.value());
      }
      else
      {
        this.__promise.realize();
      }
    }
    return this;
  },
  
  /*
    Function: applyOps
      *private*
      Apply any stored operations.
    
    Parameters:
      value - a value.
      
    Returns:
      The value after each operation has been applied in order to the
      argument.
  */
  applyOps: function(value) {
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
      realized, the return value will be value of the Promise after the 
      operation has been applied.
    
    Parameters:
      fn - a function to apply to value of the promise before realization.
  */
  op: function(fn) {
    if(!this.__realized) {
      this.__ops.push(fn);
    } else {
      this.deliver(fn(this.__value));
    }
    if(!this.__realized) return this;
    return this.value();
  },
  
  /*
    Function: deliver
      If the promises wraps a Request this is called automatically. If the
      promise is lazy, calling this will trigger the realized event.
      
    Parameters:
      value - a value.
      notify - whether to trigger the realized event.
  */
  deliver: function(value, notify) {
    if(value && value.xhr) {
      this.initReq(value);
    } else if(!this.__realized && notify !== false) {
      this.__realized = true;
      this.__value = this.applyOps(value);
      this.fireEvent('realized', this.__value);
    } else {
      this.__value = value;
    }
  },
  
  /*
    Function: value
      Returns the value of the promise. If called with true as it's argument
      will apply any queued up operations first.
      
    Paramters:
      applyOps - a boolean.
      
    Returns:
      The current value of the promise.
  */
  value: function(applyOps) {
    if(applyOps !== false) this.__value = this.applyOps(this.__value);
    return this.__value;
  },
  
  /*
    Function: isRealized
      Returns whether the promise has been realized yet.
      
    Returns:
      A boolean.
  */
  isRealized: function() { return this.__realized; },
  
  /*
    Function: isNotRealized
      Returns whether the promise has been realized yet.
      
    Returns:
      A boolean.
  */
  isNotRealized: function() { return !this.__realized; },
  
  /*
    Function: isLazy
      Public getter for whether the promise is being used for storing
      lazy values.
      
    Returns:
      A boolean.
  */
  isLazy: function() { return this.options.lazy; },
  
  /*
    Function: isNotLazy
      Public getter for whether the promise is being used for storing
      lazy values.
      
    Returns:
      A boolean.
  */
  isNotLazy: function() { return !this.options.lazy; },

  /*
    Function: get
      Often you only want a specific field from the JSON data. Get returns
      promise from promise for a specific field. Uses Function.get from
      Functools.
      
    Parameters:
      Variable
      
    Returns:
      A new Promise instance.
      
    SeeAlso:
      Function.get
  */
  get: function() {
    var args = $A(arguments);
    if(!this.isRealized())
    {
      return (new Promise(this, {lazy:this.options.lazy})).op(
        function(v) {
          var result = $get.apply(null, [v].extend(args));
          return result;
        }
      );
    }
    return Function.get.apply(null, [this.value()].extend(args));
  },
  
  /*
    Function: fn
      Similar to op except that the function is applied after the promise is
      realized. Returns a new promise.
      
    Parameters:
      A function to apply to realized value.
      
    Returns:
      A new Promise instance.
  */
  fn: function(fn) {
    if(!this.isRealized()) return (new Promise(this, {lazy:this.options.lazy})).op(fn);
    return fn(this.value());
  }
});
Promise.deref = 'data';

/*
  Function: $P, $promise
    Convenience for creating promises.
*/
var $P = $promise = function(v, options) { return new Promise(v, options); };

/*
  Constant: Promise.debug
    Global flag for running Promises in debug mode. All promises will fetch
    their remote data synchronously.
*/
Promise.debug = false;

/*
  Function: Promise.iPromise
    Convenience for determining whether an object is a Promise instance.\n
    
  Paramters:
    obj - a value.
    
  Returns:
    A boolean.
*/
Promise.isPromise = function(obj) {
  return (obj && obj.name == "Promise");
};

/*
  Function: Promise.getValue
    Get the value of promise. Checks to see if the value is indeed a promise
    and whether it is realized.
*/
Promise.getValue = function(v) {
  while (Promise.isPromise(v) && v.isRealized()) v = v.value();
  return v;
};

/*
  Function: Promise.toValues
    Map an array of values to only non-Promise values or
    unrealized Promise values.
    
  Parameters:
    An array of values.
    
  Returns:
    Returns the passed in array.
*/
Promise.toValues = function(ary) {
  while(ary.some(Promise.isPromise)) ary = ary.map(Promise.getValue);
  return ary;
};

/*
  Function: Promise.promiseOrValue
    If v is a Request object returns a promise, otherwise
    if v is Promise which has been realized returns the promises
    value. If it is an unrealized promise or not a promise,
    the promise/value is simply returned.
    
  Parameters:
    v - a value.
    
  Returns:
    A value.
*/
Promise.promiseOrValue = function(v) {
  if(v && v.xhr) return new Promise(v);
  if(Promise.isPromise(v) && v.isRealized()) return v.value();
  return v;
};

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
Promise.watch = function(args, cb, errCb) {
  var promises = args.filter(Promise.isPromise);
  var unrealized = promises.filter(Function.msg("isNotRealized"));
  
  if(unrealized.length > 0) {
    var watching = new Group(unrealized);

    watching.addEvent('realized', function() {
      args = args.map(Promise.getValue);
      if(!Promise.allRealized(args)) {
        Promise.watch(args, cb, errCb);
      } else {
        cb(Promise.toValues(args));
      }
    });

    if(errCb) {
      unrealized.each(function(aPromise) {
        aPromise.addEvent('error', errCb.bind(null, [aPromise]));
      });
    }

    // don't attempt to realize lazy values. They are realized then deliver is called on them.
    unrealized.filter(Function.msg('isNotLazy')).each(Function.msg('realize'));
  } else {
    cb(Promise.toValues(args));
  }
};

/*
  Function: Promise.allRealized
    Check whether an array of values contains only values and/or realized
    Promises.
    
  Parameters:
    vs - an array.
  
  Returns:
    A boolean.
*/
Promise.allRealized = function(vs) { return vs.filter(Promise.isPromise).every(Function.msg("isRealized")); };

/*
  Decorator: promise
    The promise decorator. Takes a function and returns a new function that
    can handle Promises as arguments. If this new function recieves any Promises
    it will continue to block until it can convert all of it's arguments to 
    non-Promise values.
    
  Parameters:
    fn - the function to decorate.
    
  Returns:
    A function decorate to handle promises in it's arguments.
*/
function promise(fn) {
  return function decorator() {
    var args = $A(arguments);
    var promises = args.filter(Promise.isPromise);
    var unrealized = promises.filter(Function.msg('isNotRealized'));
    
    if(unrealized.length > 0) {
      if(!Promise.debug) {
        var p = new Promise();
        Promise.watch(
          args, 
          function(values) {
            // hack so that this.parent(...) is meaningful even after an async call
            var temp = this._current;
            this._current = decorator._wrapper;
            p.deliver(fn.apply(this, values));
            this._current = temp;
          }.bind(this),
          function(errPromise) {
            var err = new Error("Failed to realize promise from " + errPromise.__req.options.url);
            err.promise = errPromise;
            err.source = fn.toString();
            err.sourceArgs = args;
            throw err;
          }.bind(this));
        return p;
      } else {
        var temp = this._current;
        unrealized.each(Function.msg('realize'));
        var values = args.map(Promise.getValue);
        this._current = decorator._wrapper;
        result = fn.apply(this, values);
        this._current = temp;
        return result;
      }
    } else {
      var porv = Promise.promiseOrValue(fn.apply(this, args.map(Promise.getValue)));
      return porv;
    }
  };
}

/*
  Function: $if
    It's important to be able to deal with branching conditions when using
    Promises. Of course this impossible with asynchronous values, therefore
    the existance of $if.
    
  Parameters:
    test - a value. If truth-y true branch is executed, false-y branch
      otherwise.
    trueExpr - a function to be executed if the test is truth-y. This function
      will passed the value of the promise.
    falseExpr - a function to be executed if the test is false-y. This
      function will be passed the value of the promise.
*/
var $if = function(test, trueExpr, falseExpr) {
  if(test) {
    if($type(trueExpr) == "function") return trueExpr(test);
    return trueExpr;
  } else if(falseExpr) {
    if($type(falseExpr) == "function") return falseExpr(test);
    return falseExpr;
  }
}.future();

/*
  Function: $and
    Meant to be used with $if for the test.
    
  Parameters:
    Variable.
*/
var $and = function() {
  var args = $A(arguments);
  return args.every($identity);
}.future();