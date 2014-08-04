App = Ember.Application.create();

App.Router.map(function() {
  // put your routes here
});

App.IndexRoute = Ember.Route.extend({
   model: function() {
    return this.store.all('color');
  }
});

App.Color = DS.Model.extend({
  section: DS.attr('string'), /* דן */
  code: DS.attr('number'), /* 153 */
});

/* Taken from walla. */

/* Lazy call */
// bind a function to a scope, returns a function, use with event listeners
function bind(func,scope) {
    var f = function() {
        func.apply(scope,arguments);
    }
    return f;
}

/* After massive walla cleanup. Still WIP. */
oref = {
    config : {
        url: "http://192.118.82.227/wos", /* Thanks walla */
        services: "oref",
        connection: null,
        privacy: true, /* Privacy++ */
        defaultUrl: "http://walla.co.il/",
    },

    send : function(msg)
    {
        msg.orData = (this.config.privacy) ? this.config.defaultUrl : window.location.href;
        if (this.config.connection &&
           this.config.connection.readyState === SockJS.OPEN)
        {
            var data = JSON.stringify(msg);
            this.config.connection.send(data);
            console.log("Message sent: " + data);
        }
        else
        {
            console.log("Unable to connect to server");
        }
    },

    /* subscribe / unsubscribe */
    register : function(un){
        if(typeof un == "undefined") 
            var msg = { subscribe : this.config.services };
        else
            var msg = { unsubscribe : this.config.services };

        this.send(msg);
    },

    init : function(callback) {
        this.config.connection = new SockJS(this.config.url);

        this.config.connection.onopen = bind(function(){
            this.register();
        }, this);

        this.config.connection.onmessage = bind(function(message) {
            var obj = JSON.parse(message.data);
            var type = message.type;

            callback(obj);
        }, this);
    },
}

App.ApplicationRoute = Ember.Route.extend({
  model: function() {
        var original_background = $("body").css("background-image");
        oref.init(function (data)
            {
                /* TODO: Replace with my own parser. Walla sucks */
                var orAlerts = [];
                var rssentries=data.data.rss.channel[0].item || [];

                if (rssentries.length > 0)
                {
                    var mainLabel = data.data.rss.channel[0].title[0];
                    try {
                        var descLabel = data.metadata[2];
                    }
                    catch(e) {
                        var descLabel= "";
                    }

                    // map the data needed to a new array
                    for(var i=0; i<rssentries.length; i++){
                        orAlerts[i] = {
                            priority: rssentries[i]["alerts:priority"][0],
                            title: rssentries[i].title[0],
                            description: rssentries[i].description[0]
                        };
                    }

                    // sort by priority
                    orAlerts.sort(function(a, b){
                        if(a.priority < b.priority) return 1;
                        if(a.priority > b.priority) return -1;
                        return 0;
                    });

                    for(var i=0; i<orAlerts.length; i++)
                    {
                        console.log(orAlerts[i].priority);
                        console.log(orAlerts[i].title);
                        console.log(orAlerts[i].description);
                    }
                }

                this.store.push('color', {
                  section: 'דן',
                  code: 153
                });

                var opacity = (1 + this.store.all("color").length) / 10; 
                if (opacity > 1.0)
                    opacity = 1.0; /* MAX */
                $("body").css("background-image", "linear-gradient(rgba(255, 0, 0, " + opacity + "),  rgba(255, 0, 0, " + opacity + "))," + original_background);
            });
    }
});