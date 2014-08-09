App = Ember.Application.create();

App.Router.map(function() {
  // put your routes here
});

App.Alert = Ember.Object.extend();

App.Alert = DS.Model.extend({
  area_id: DS.attr('number'),
  area_name: DS.attr('string'),
  time:  DS.attr('date'),
  area_lat: DS.attr('number'),
  area_long: DS.attr('number'),
});

App.Alert.reopenClass({
  all: function() {
        return $.getJSON('http://tzeva-adom.com/alerts.php?fmt=jsonp&source=pikud,test&limit=5&callback=?').then(function(response) {
            console.log(App.Alert.create(response))
            return null;
        });
    },

    expireTime: 6,

    create: function ()
    {
        var items = this._super(arguments);
        // Expiring.
        setTimeout(function expiredAlert() {
            console.log(items);
            items[0].forEach(function removeAlert(alert)
                {
                    console.log("Alert expired: " + alert);
                    alert.delete();
                });
        }, App.Alert.expireTime * 1000);

        return items;
    },
});

App.IndexRoute = Ember.Route.extend({
   model: function() {
        console.log("Model");
        data = App.Alert.all();

        var alerts = new Alerts("http://tzeva-adom.com:8080/redalert");
        alerts.callback(function(response) { 
            response.forEach(function (item) {
                items.push( App.Alert.create(item) );
            });
        });
        alerts.poll();

        var original_background = $("body").css("background-image");
        var opacity = (1 + data.length) / 10; 
        if (opacity > 1.0)
            opacity = 1.0; /* MAX */
        $("body").css("background-image", "linear-gradient(rgba(255, 0, 0, " + opacity + "),  rgba(255, 0, 0, " + opacity + "))," + original_background);
        return data;
    },
});

App.LiveMapView = Ember.View.extend({
    classNames: ['live-map'], 
    templateName: 'live-map',

    // Ember is awesome.
    didInsertElement: function()
    {
        /* Initialize map */
        var map = new google.maps.Map(this.$().get(0), {
                zoom: 10,
                center: new google.maps.LatLng(31.4, 34.5),
                mapTypeId: google.maps.MapTypeId.ROADMAP
        });

        this.set("map", map); /* Useful for inserting circles */
        this.contentDidChange();
    },

    contentDidChange: function() {
        var map = this.get("map");

        this.get('controller.content').forEach(function alertCircle(alert)
        {
            /* Thanks to redalert.co.il */
            var circle = new google.maps.Circle({
                strokeColor: "red",
                strokeWeight: 1,
                fillColor: "red",
                fillOpacity: 0,
                map: map,
                center: new google.maps.LatLng( alert.area_lat, alert.area_long ),
                radius: 0
            });

            // expand animation
            var opacity = .5;
            var expand = function() {
                var radius = circle.get( "radius" ) + 1500;
                circle.set( "radius", radius );
                if ( radius < 3000 ) {
                    return requestAnimationFrame( expand );
                }

                setTimeout( function() {
                    circle.set( "fillOpacity", opacity );
                    circle.set( "strokeWeight", 0 );
                    fade();
                }, 300 );
            }
            requestAnimationFrame( expand );

            var fade = function() {
                var opacity = circle.get( "fillOpacity" ) - (( window.location.hash == "#slow" ) ? 0.005 : 0.01);
                if ( window.location.hash == "#nofade" && opacity > 0 && opacity < 0.1 ) {
                    return; // no more fading
                }


                circle.set( "fillOpacity", opacity );
                if ( opacity <= 0 ) {
                    return circle.setMap( null );
                }
                requestAnimationFrame( fade );
            }
        });
      }.observes('controller.content'),
});

// Gadi Cohen, nov12, GPLed.   v0.1
// See http://tzeva-adom.com/alerts.html

/**
  * Alerts class constructor.  Initiates a new Alerts object, which handles
  * JSONP long polling to the server (see below).
  * @constructor
  *
  * @param url    Defaults to http://currenthost:8080/redalert
  * <br>          You'll want http://tzeva-adom.com:8080/redalert on external code
  *
  * @return Alerts object
  */
function Alerts(url) {
    this.timeout = 0;
    this.callbacks = [];
    this.sleeptime = 1000;
    if (!url) url = "http://" + window.location.host + ":8080/redalert";
    this.url = url;
    this.lastSuccess = null;
    this.failureCount = 0;
}

/**
  * Specify a callback function to be called whenever there is new data
  * from the server.  The function will be called with the new data as it's
  * only argument.  You may add as many callback functions as required.
  *
  * @param callback   - function reference or anonymous function
  *
  */
Alerts.prototype.callback = function(callback) {
    this.callbacks.push(callback);
}

/**
  * Performs a JSONP "long poll" (a "reverse ajax" technique)
  * This is the main code that interacts with the server to retrieve new information.  With long polling,
  * the XHR request is blocked on the server side (and kept open on the client) until there is new data to
  * send.  It sends the data, closes the connection, and initiates a new connection to wait for data again.
  * JSONP is used to allow for cross-domain requests.
  */
Alerts.prototype.poll = function() { 
    var _this = this;
    $.ajax({
        url: this.url,
        dataType: 'jsonp',
        jsonpCallback: 'redalert',
        success: function(data) {
            _this.lastSuccess = new Date();
                        for (var i=0; i < _this.callbacks.length; i++)
                            _this.callbacks[i](jQuery.parseJSON(data));
            _this.poll();
        },
        error: function(jqXHR, textStatus, errorThrown) {
            _this.failureCount++;
            console.log('Error: ' + textStatus + ' ' + errorThrown + ', sleeping...');
            _this.timeout = setTimeout(function() { _this.poll(); }, _this.sleeptime);
        }
    });
} 

// requestAnimationFrame shim
// http://www.paulirish.com/2011/requestanimationframe-for-smart-animating/
var lastTime = 0;
var vendors = ['webkit', 'moz'];
for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
    window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
    window.cancelAnimationFrame =
      window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
}

if (!window.requestAnimationFrame)
    window.requestAnimationFrame = function(callback, element) {
        var currTime = new Date().getTime();
        var timeToCall = Math.max(0, 16 - (currTime - lastTime));
        var id = window.setTimeout(function() { callback(currTime + timeToCall); },
          timeToCall);
        lastTime = currTime + timeToCall;
        return id;
    };

if (!window.cancelAnimationFrame)
    window.cancelAnimationFrame = function(id) {
    clearTimeout(id);
};