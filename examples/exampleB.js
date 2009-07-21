window.addEvent('domready', exmaple);


var MyClass = new Class({
  a: function() 
  {
    return new Request({
      method: 'get',
      url: 'a.json'
    });    
  }.decorate(promise),
  
  b: function()
  {
    return new Request({
      method: 'get',
      url: 'b.json'
    });    
  }.decorate(promise),
  
  add: function(a, b)
  {
    return a + b;
  }.decorate(promise)
});


var MySubClass = new Class({
  add: function(a, b)
  {
    return this.parent().op(function(value) { value += "!"; });
  }.decorate(promise)
});


var show = function(value, target)
{
  target.setPropert('value', value);
}.decorate(promise)


function example()
{
  var instance = new MySubClass()
  show(instance.add(instance.a(), instance.b()));
}
