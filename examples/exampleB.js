window.addEvent('domready', example);


var MyClass = new Class({
  a: function() 
  {
    return new Request({
      url: 'data/a.json'
    });    
  }.decorate(promise),
  
  b: function()
  {
    return new Request({
      url: 'data/b.json'
    });    
  }.decorate(promise),
  
  add: function(a, b)
  {
    return a + b;
  }.decorate(promise)
});


var MySubClass = new Class({
  Extends: MyClass,

  add: function(a, b)
  {
    return this.parent(a, b) + "!";
  }.decorate(promise)
});


var show = function(value, target)
{
  $(target).setProperty('value', value);
}.decorate(promise)


function example()
{
  var instance = new MySubClass()
  show(instance.add(instance.a(), instance.b()), "ex1");
}
