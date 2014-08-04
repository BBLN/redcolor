App = Ember.Application.create();

App.Router.map(function() {
  // put your routes here
});

App.IndexRoute = Ember.Route.extend({
   model: function() {
    var url = 'http://www.oref.org.il/WarningMessages/alerts.json';
    return Ember.$.getJSON(url).then(function(data) {
      return data["data"]
    });
  }
});
