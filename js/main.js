/**
 * This file is the primary javascript for the neighboarhood map app
 */


var TheMap = function(){

    this.Zoom = 10;
    this.mapOptions = {
        zoom: this.Zoom,
        //draggable: false,
        //scrollwheel: false,
        panControl: false,
        disableDefaultUI: true,
        center: new google.maps.LatLng(33.0425741,-96.9907839),
        mapTypeId: google.maps.MapTypeId.ROADMAP
        };

    this.map =
        new google.maps.Map(document.getElementById('map'), this.mapOptions);

     /* this adds the search ui as a control
      * it is unused at the moment because it messes with infowindows on mobile
      * but it is left in as a comment so I can experiment with it more later
      * easily
      */
};

/**
 * This is the primary knockout view model and data for the app
 * 
 */
var viewModel = function(){
    /* scope alias */
    var self = this;
    /* clear session storage any time we load */
    sessionStorage.clear();

    self.maxListNum =
        ko.observable(Math.max(1,Math.ceil(($(window).height() -150)/30)));
   
    self.listVisible = ko.observable(1);
    
    self.listPoint = ko.observable(1);

    if (typeof google !== 'object' || typeof google.maps !== 'object'){
        console.log("error loading google maps api");

		this.pointFilter = ko.observable("Error Loading Google Maps Api");
		
        //return early since we have no maps.  No point in doing much else.
        return;
    }

    
    self.theMap = new TheMap();
    window.map = self.theMap.map;
    
	self.zNum = 1;
 
    self.refitFilterCheck = ko.observable(true);
   
    self.refitResizeCheck = ko.observable(true);
   
    self.searchCategoryCheck = ko.observable(false);
   
    self.listVisible = ko.observable(true);
   
    self.rollupText = ko.observable('collapse list');
    
    self.rollupIconPath = ko.observable('img/collapseIcon.png');

    self.infoMaxWidth = Math.min(400,$(window).width() * .8);
    /* max number of 4 square tips to collect.  Based somewhat on
     * size of the user window width.  SHould range from 1 to 5.
     */
    self.max4Stips = Math.max( 1,
        Math.min( 5, Math.floor( $(window).width() / 200 )));

    self.removePoint = function(point) {
        self.points.remove(point);
    };

   
    self.centerToPoint = function(point, offsetIt) {
        if (offsetIt !== true) {
            self.theMap.map.setCenter(point.marker.position);
        }
        else {
            var scale = Math.pow(2, self.theMap.map.getZoom());
            var mapHeight = $(window).height();
            var projection = self.theMap.map.getProjection();
            var pixPosition = projection.fromLatLngToPoint(point.marker.position);
            var pixPosNew = new google.maps.Point(
                pixPosition.x,
                pixPosition.y - (mapHeight * .45 / scale)
            );
            var posLatLngNew = projection.fromPointToLatLng(pixPosNew);
            self.theMap.map.setCenter(posLatLngNew);
        }
    };

    self.selectPoint = function(point) {
      
        var oldPoint = self.currentPoint();
       
        self.centerToPoint(point, true);
        
        if ($(window).width() < 800) {self.toggleList(false);}
        self.currentPoint(point);
       
        var storedContent = sessionStorage.getItem("infoKey" +
            self.currentPoint().name +
            self.currentPoint().lat() + self.currentPoint().long());

        if (storedContent){
            self.infowindow.setContent(storedContent);
            self.infowindow.open(self.theMap.map, point.marker);
            self.infowindow.isOpen = true;
            self.checkPano(true);
        }
        else {
            
            self.infowindow.setContent('<div id="infoContent" ' +
                'class="scrollFix">loading...</loding>');
            self.infowindow.open(self.theMap.map, point.marker);
            self.infowindow.isOpen = true;
           
            self.get4Sinfo(point);
        }
        
        point.marker.setZIndex(point.marker.getZIndex() + 5000);
      
        if (point.hovered() === true){
            point.hovered(false);
            self.mouseHere(point);
        }
        else{
            self.mouseGone(point);
        }
        
        if (oldPoint !== null && oldPoint !== undefined) {
            if (oldPoint.hovered() === true){
                oldPoint.hovered(false);
                self.mouseHere(oldPoint);
            }
            else{
                self.mouseGone(oldPoint);
            }
        }
    };

    self.getStyle = function(thisPoint){
        if (thisPoint === self.currentPoint()){
            if(thisPoint.hovered() === true) {
                //hovering over selected point
                return 'hoveredCurrentListPoint';
            }
            else {
                
                return 'currentListPoint';
            }
        }
        else if (thisPoint.hovered() === true){
            //hovering over non selected point
            return 'hoveredListPoint';
        }
    };

  
    self.mouseHere = function(point) {
        if (point.hovered() !== true) {
            point.hovered(true);
           
            if (point.marker.getZIndex() <= self.zNum) {
                point.marker.setZIndex(point.marker.getZIndex() + 5000);
            }
            if (self.currentPoint() === point) {
                point.marker.setIcon(point.activeHoverIcon);
            }
            else {
                point.marker.setIcon(point.hoverIcon);
            }
        }
    };

    
    self.mouseGone = function(point) {
        if (point.hovered() === true) {
            point.hovered(false);
        }
            
            if (point.marker.getZIndex() > self.zNum && point !==
                self.currentPoint()) {

                point.marker.setZIndex(point.marker.getZIndex() - 5000);
            }
            if (self.currentPoint() === point) {
                point.marker.setIcon(point.activeIcon);
            }
            else {
                point.marker.setIcon(point.defaultIcon);
            }

    };

   
    self.point = function(name, lat, long, draggable, category) {
      
        this.defaultIcon = 'https://mt.googleapis.com/vt/icon/name=icons/' +
        'spotlight/spotlight-poi.png';
        this.activeHoverIcon = 'https://mt.google.com/vt/icon?psize=20&font=' +
            'fonts/Roboto-Regular.ttf&color=ff330000&name=icons/spotlight/' +
            'spotlight-waypoint-a.png&ax=44&ay=48&scale=1&text=X';
        this.activeIcon = 'http://mt.google.com/vt/icon?psize=30&font=fonts/' +
            'arialuni_t.ttf&color=ff00ff00&name=icons/spotlight/spotlight' +
            '-waypoint-a.png&ax=43&ay=48&text=%E2%80%A2';
        this.hoverIcon = 'https://mt.google.com/vt/icon?color=ff004C13&name=' +
            'icons/spotlight/spotlight-waypoint-blue.png';
        
        this.name = name;
       
        this.lat = ko.observable(lat);
        this.long = ko.observable(long);

        this.category = category;
       
        this.hovered = ko.observable(false);

        /* the map marker for this point */
        this.marker = new google.maps.Marker({
            position: new google.maps.LatLng(lat, long),
            title: name,
            map: self.theMap.map,
            draggable: draggable,
            zIndex: self.zNum
        });

       
        self.zNum++;


       
        google.maps.event.addListener(this.marker, 'click', function() {
            self.selectPoint(this);
        }.bind(this));

        //mouse over event for this point's marker
        google.maps.event.addListener(this.marker, 'mouseover', function() {
            self.mouseHere(this);
        }.bind(this));

     
        google.maps.event.addListener(this.marker, 'mouseout', function() {
            self.mouseGone(this);
        }.bind(this));
    };
	
	// Check for errors in forsquare response
	  self.checkError = function(data) {
		if(data.length < 1) {
		  return false;
		}
		else {
		  return true;
		}
	  };


    
	// Venue call set limit 50 within 50,000 meters
	// client registered to my personal foursquare / website
    var four_square_baseUrl = "https://api.foursquare.com/v2/venues/explore?" +
    "client_id=I3NKQS2JLKKMMS3PMYJG0HTC42LNNCZA2L1EUPSWZYVTTJWA&" + 
    "client_secret=P320IL4IMS221O3SWD0V2PWD15LERQ5LASJMUE13BYYMRP3U&" +
    "v=20150430&" + 
    "radius=50000&" + 
    "limit=50&";

    // get query from filter input when requested
    var query = $("#filterInput").val();
	// Points of intrest are for Homer AK:
    var urlToRequest = four_square_baseUrl + "ll=59.6400705,-151.6017649" + "&query=" + query;
	
	console.log(urlToRequest);
	var bounceTimer;
	
	self.points = ko.observableArray([]);
	
    // finally make the ajax call
    $.getJSON(urlToRequest, function(data) {
      var venues = data.response.groups[0].items;
      if(self.checkError(venues) === false) {
        alert(
          "No results found.\nPlease try a different key word."
          );
        return;
      }
	
      for(var index in venues) {
		self.points.push(new self.point(venues[index].venue.name, venues[index].venue.location.lat, venues[index].venue.location.lng, false, venues[index].venue.categories[0].name));
    }
	
	
	
    // Display error if the ajax call fails
    }).error(function() {
      alert(
        "Cannot reach to the foursquare server!\nPlease try it later!"
        );
    });
	
    self.currentPoint = ko.observable();

    /* filter from our search box.
     * changing it will recalc shownPoints computed array.
     */
    self.pointFilter = ko.observable('');

    /* calculated array containing just the filtered results from points()*/
    self.shownPoints = ko.computed(function() {
        return ko.utils.arrayFilter(self.points(), function(point) {
            if (self.searchCategoryCheck() === true){
                return (self.pointFilter() === '*' ||
                    point.name.toLowerCase().indexOf(self.pointFilter().
                        toLowerCase()) !== -1);
            }
            else{
                return (self.pointFilter() === '*' ||
                    (point.name.toLowerCase().indexOf(self.pointFilter().
                        toLowerCase()) !== -1 ||
                    point.category.toLowerCase().indexOf(self.pointFilter().
                        toLowerCase()) !== -1));
            }
        });
    }, self);

  
    self.shownPoints.subscribe(function() {
      
        self.toggleMarkers();

        if (self.infowindow.isOpen === true){
            self.infowindow.close();
            self.infowindow.isOpen = false;
            self.infoWindowClosed();
        }
    });


    self.listPage = ko.computed(function(){

        return Math.max(1,Math.ceil( self.listPoint()/self.maxListNum()));
    });

      self.shownList = ko.computed(function(){
        return self.shownPoints().slice(self.listPoint()-1,
            self.listPoint()-1 + self.maxListNum());
    });

    self.totalPages = ko.computed(function(){
        return Math.max(1,Math.ceil(
            self.shownPoints().length/self.maxListNum() ));
    });

    self.pageText = ko.computed(function(){
        return 'Current List Page: <strong>' + self.listPage() +
            '</strong> of <strong>' + self.totalPages() +
            '</strong> (' + self.shownPoints().length + ' locations)';
    });

    self.prevPageText = ko.computed(function(){
        if (self.listPage() > 1){
            return 'page: ' + (self.listPage() - 1) + ' <' ;
        }
        else {
            self.listPoint(1);
            return self.listPage();
        }
    });


    self.nextPageText = ko.computed(function(){
        if (self.totalPages() > self.listPage()){
            return '> page: ' + (self.listPage() + 1) ;
        }
        else {
            return self.listPage();
        }
    });


 
    self.changePage = function(direction){
        if(direction === 1 && self.totalPages() > self.listPage()){
            self.listPoint(self.listPoint()+self.maxListNum());
        }
        else if(direction === -1 && self.listPage() > 1){
            self.listPoint(self.listPoint()-self.maxListNum());
        }
    };

  
    self.toggleList = function(makeVisible){
        console.log(typeof makeVisible);
       
        if (typeof makeVisible !== 'boolean') {
            if (self.listVisible() === 0) {
                makeVisible = true;
            }
            else {
                makeVisible = false;
            }
        }


        if(makeVisible === true){
            self.listVisible(1);
            self.rollupText('collapse list');
            self.rollupIconPath('img/collapseIcon.png');
        }
        else if (makeVisible === false){
            self.listVisible(0);
            self.rollupText('expand list');
            self.rollupIconPath('img/expandIcon.png');
        }

    };

    self.toggleMarkers = function(){
  
        var i;
        var pointsLen = self.points().length;
        for (i = 0; i < pointsLen; i++) {
            var thisPoint = self.points()[i];
            thisPoint.marker.setVisible(false);
            thisPoint.hovered(false);
            /* set icons */
            if (self.currentPoint() === thisPoint) {
                thisPoint.marker.setIcon(thisPoint.activeIcon);
            }
            else {
                thisPoint.marker.setIcon(thisPoint.defaultIcon);
            }
        }

        for (i = 0; i < pointsLen; i++) {
            /* make sure the point is defined before messing with it */
            var thisPoint = self.shownPoints()[i];
            if (thisPoint) {thisPoint.marker.setVisible(true);}
        }

        if(self.refitFilterCheck() === true){self.refitMap();}
    };


    self.refitMap = function() {
        //set bounds to a fresh viewpoints bounds so we start clean
        var bounds = new google.maps.LatLngBounds();

        var pointsLen = self.shownPoints().length;
        if(pointsLen >= 2) {
            for (var i = 0; i < pointsLen; i++) {
               
                bounds.extend (self.shownPoints()[i].marker.position);
            }
            
            self.theMap.map.fitBounds(bounds);
        }
    };

  
    this.getStreetViewUrl = function(point){
        return 'https://maps.googleapis.com/maps/api/streetview?' +
        'size=300x300&location=' + point.lat() + ',' + point.long();
    };

    /* this will hold the foursquare specific content in our infowindow */
    self.the4Sstring = '';

 
    this.get4Sinfo = function(point){
        /* the foursquare api url */
        var url = 'https://api.foursquare.com/v2/venues/search?client_id=' +
            'NFLHHJ350PG5BFEFQB2AZY2CJ3TUCUYR3Q14QPL5L35JT4WR' +
            '&client_secret=WDNBZ4J3BISX15CF1MYOBHBP2RUSF2YSRLVPZ3F' +
            '4WZUYZGWR&v=20130815' + '&ll=' + point.lat() + ',' +
            point.long() + '&query=\'' + point.name + '\'&limit=1';

        $.getJSON(url)
            .done(function(response){
              
                self.the4Sstring = '<p>Foursquare Details:<br>';
                var venue = response.response.venues[0];
                
                var venueId = venue.id;

                var venueName = venue.name;
                if (venueName !== null && venueName !== undefined){
                    self.the4Sstring = self.the4Sstring + 'Name: ' +
                        venueName + '<br>';
                }
                /* phone number */
                var phoneNum = venue.contact.formattedPhone;
                if (phoneNum !== null && phoneNum !== undefined){
                    self.the4Sstring = self.the4Sstring + 'Phone: ' +
                        phoneNum + '<br>';
                }
                /* twitter */
                var twitterId = venue.contact.twitter;
                if (twitterId !== null && twitterId !== undefined){
                    self.the4Sstring = self.the4Sstring + 'Twitter: ' +
                        twitterId + '<br>';
                }
                /* address */
                var address = venue.location.formattedAddress;
                if (address !== null && address !== undefined){
                    self.the4Sstring = self.the4Sstring + 'Address: ' +
                        address + '<br>';
                }
                /* category */
                var category = venue.categories.shortName;
                if (category !== null && category !== undefined){
                    self.the4Sstring = self.the4Sstring + 'Category: ' +
                        category + '<br>';
                }
                /* checkins */
                var checkinCount = venue.stats.checkinsCount;
                if (checkinCount !== null && checkinCount !== undefined){
                    self.the4Sstring = self.the4Sstring + '# of checkins: ' +
                        checkinCount + '<br>';
                }
                /* tips */
                var tipCount = venue.stats.tipCount;
                if (tipCount > 0) {
                    self.get4Stips(venueId, point);
                }
                else{
                  
                    self.the4Sstring = self.the4Sstring + '</p>';
                   
                    self.checkPano();
                }
            })
            .fail(function(){
                self.the4Sstring = 'Fouresquare data request failed';
                console.log('Fouresquare data request failed');
                self.checkPano();                
            });

    };

    this.get4Stips = function(venueId, point){
        /* the foursquare tips api url */
        var url ='https://api.foursquare.com/v2/venues/' + venueId + '/tips' +
            '?client_id=I3NKQS2JLKKMMS3PMYJG0HTC42LNNCZA2L1EUPSWZYVTTJWA' +
            '&client_secret=P320IL4IMS221O3SWD0V2PWD15LERQ5LASJMUE13BYYMRP3U&' +
            'v=20130815';

        $.getJSON(url)
            .done(function(response){
                /* object */
                var tipCount = Math.min(self.max4Stips,
                    response.response.tips.count);
                /* tips */
                self.the4Sstring = self.the4Sstring + '<br>Tips: <ul>';
                for(var i=0;i<tipCount;i++){
                    self.the4Sstring = self.the4Sstring + '<li>' +
                        response.response.tips.items[i].text + '</li>';
                }

                self.the4Sstring = self.the4Sstring + '</ul></p>';
                
                self.checkPano();
            })
            .fail(function(){
                
                self.the4Sstring = self.the4Sstring + '</p>';
                console.log('Fouresquare failed to loads tip information' + 
                    ' attempting to load what we have into the infowindow');
				alert('Fouresquare failed to loads tip information' + 
                    ' attempting to load what we have into the infowindow');
                self.checkPano();
            });
    };



    self.contentString = function(includePano){
        var retStr = '<div id="infoContent" class="scrollFix">' +
            self.the4Sstring;
       
        if (includePano === true) {
            retStr = retStr +
                '<div id="panoContent"></div>';
        }
        retStr = retStr + '</div>';
      
        sessionStorage.setItem("infoKey" + self.currentPoint().name +
            self.currentPoint().lat() + self.currentPoint().long(), retStr);
        
        return retStr;
    };


    self.infowindow = new google.maps.InfoWindow({
        content: '<div id="infoContent" class="scrollFix">loading...</loding>',
     
        maxWidth: self.infoMaxWidth
    });

   
    self.pano = null;

    
    self.streetViewService = new google.maps.StreetViewService();

    self.checkPano = function(skipContent) {

        //if we have a small screen, skip the panorama
        if ($(window).width() <= 800) {
            if (skipContent !== true) {
                self.infowindow.setContent(self.contentString(false));
            }
            
            return;
        }
       
        self.streetViewService.getPanoramaByLocation(
            self.currentPoint().marker.position,80,
            function (streetViewPanoramaData, status) {

            if (status === google.maps.StreetViewStatus.OK) {
           
                if (skipContent !== true) {
                    self.infowindow.setContent(self.contentString(true));
                }
                if (self.pano !== null) {
                    self.pano.unbind("position");
                    self.pano.setVisible(false);
                }
                self.pano = new google.maps.StreetViewPanorama(
                    document.getElementById("panoContent"), {

                    navigationControl: true,
                    navigationControlOptions: {
                        style: google.maps.NavigationControlStyle.ANDROID},
                    enableCloseButton: false,
                    addressControl: false,
                    linksControl: false
                });
                self.pano.setPano(streetViewPanoramaData.location.pano);
                self.pano.setVisible(true);
            }
            else {
           
                if (skipContent !== true) {
                    self.infowindow.setContent(self.contentString(false));
                }
            }
        });
    };

  
    self.infoWindowClosed = function(){
        if (self.pano !== null && self.pano !== undefined){
            self.pano.unbind("position");
            self.pano.setVisible(false);
            self.pano = null;
        }
       
        if ($(window).width() < 800) {
            self.toggleList(true);
        }
        
        self.refitMap();
    };

    
    google.maps.event.addListener(self.infowindow, 'closeclick', function() {
        self.infoWindowClosed();
    });

   
    google.maps.event.addListener(self.theMap.map, "click", function(){
        if (self.infowindow.isOpen === true){
            self.infowindow.close();
            self.infowindow.isOpen = false;
            self.infoWindowClosed();
        }
    });

    google.maps.event.addDomListener(self.infowindow, 'domready', function() {
        $('#infoContent').click(function() {
        
            if ($(window).width() <= 800 && self.infowindow.isOpen === true){
                self.infowindow.close();
                self.infowindow.isOpen = false;
                self.infoWindowClosed();
            }
        });
    });


    $(window).resize(function () {
     
        self.maxListNum(Math.max(1,Math.ceil(($(window).height() -150)/30)));

        if (self.refitResizeCheck()) {
            self.refitMap();
        }
    });


    self.refitMap();
};


$(function(){
    // ko.applyBindings(new viewModel());
});


var googleMapErrorHandling = function(){
	alert(
          "No results found.\nPlease try a different point of interest."
          );
};
