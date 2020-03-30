let hospitals = {
  "url": "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Hospitals_1/FeatureServer/0/query?where=1%3D1&outFields=OBJECTID,ID,NAME,ADDRESS,CITY,STATE,ZIP,TELEPHONE,POPULATION,COUNTY,LATITUDE,LONGITUDE,NAICS_CODE,WEBSITE,ST_FIPS,BEDS,TRAUMA&outSR=4326&f=json",
  "method": "GET",
  "timeout": 0,
};
let coronacases = {
  "url": "https://api.covid19api.com/country/us/status/confirmed/live",
  "method": "GET",
  "timeout": 0,
};

function isClose(lat1, lon1, lat2, lon2) {
  radius = 0.5// 0.28419042405 // in degrees
  return (Math.sqrt((lat1-lat2)*(lat1-lat2) + (lon1-lon2)*(lon1-lon2)) <= radius)
};
function covidGeoJSON(data) {
  let geojson = {
    "type": "FeatureCollection",
    "features": []
   }
   for(d of data){
     if (d.Cases != 0) {
      geojson.features.push(
      {
          "type": "Feature",
          "geometry" : {
              "type": "Point",
              "coordinates": [d.Lon, d.Lat],
          },
          "properties" : d
      })
   }}
   return geojson
}
function toGeoJSON(data) {
  let geojson = {
    "type": "FeatureCollection",
    "features": []
   }
   for(d of data.features){
      geojson.features.push(
      {
          "type": "Feature",
          "geometry" : {
              "type": "Point",
              "coordinates": [d.attributes.LONGITUDE, d.attributes.LATITUDE],
          },
          "properties" : d
      })
   }
   return geojson
}
function get_beds_nearby(lat, lon, hospitals, radius=0.5) {
  beds = 0
  for (h of hospitals) {
    if (isClose(h.properties.attributes.LATITUDE, h.properties.attributes.LONGITUDE, lat, lon) && h.properties.attributes.BEDS != -999) {
      beds += h.properties.attributes.BEDS
    }
  }
  return beds
}
function getRiskString(hospitalbeds,near_cases, hospital_beds_nearby, percent_beds_taken = 0.5, percentage_hospitalized_need = 0.12){
    // Add all hospitals in area (beds)
    // Get all covid patients in area
    // 12% of people with covid need beds
    // (covid patients * 0.12)/# of beds in the area
    // HOSPITAL OVERFLOW RISK:
    // if number > 1 DISASTER.
    // if number between 0.8-1 HIGH RISK
    // else if between 0.5-0.8 MODERATE RISK
    // else if 0-0.5 Low RISK
    const selfBeds = hospitalbeds
    if (selfBeds == -999) {
      return "Risk: Unknown"
  }
    let available_beds = (1-percent_beds_taken)*(hospital_beds_nearby + selfBeds)
    let hospitalized_need = percentage_hospitalized_need * near_cases;
    let risk_factor = hospitalized_need/available_beds
    let beds_for_low_risk = Math.round(hospitalized_need/0.5)
    let beds_for_moderate_risk = Math.round(hospitalized_need / 0.8)
    let beds_for_high_risk = Math.round(hospitalized_need)
    if(risk_factor >= 1){
      return `<h5>Risk: <span class="extreme">Extreme</span></h5><div class="progress"><div class="progress-bar" style="width:100%"></div></div><br> <h5>Beds needed to reduce danger to... <br> High Risk: ${beds_for_high_risk} <br> Moderate Risk: ${beds_for_moderate_risk} <br> Low Risk: ${beds_for_low_risk}</h5>`
    } else if(risk_factor <= 0.8 && risk_factor >= 0.5){
      return `<h5>Risk: <span class="moderate">Moderate</span></h5><div class="progress"><div class="progress-bar" style="width:${risk_factor*100}%"></div></div> <br> <h5>Beds needed to reduce danger to... <br> Low Risk: ${beds_for_low_risk}</h5>`
    } else if(risk_factor > 0.8) {
      return `<h5>Risk: <span class="high">High</span></h5><div class="progress"><div class="progress-bar" style="width:${risk_factor*100}%"></div></div><br><h5>Beds needed to reduce danger to ... <br> Moderate Risk: ${beds_for_moderate_risk} <br> Low Risk: ${beds_for_low_risk}</h5>`
    } else {
      return `<h5>Risk: <span class="low">Low</span></h5><div class="progress"><div class="progress-bar" style="width:${risk_factor*100}%"></div></div>`
    }

  }

// }
let response = $.ajax(hospitals);
let response2 = $.ajax(coronacases);
$.when(response, response2).then(function(response, response2) {
  $("#loading").hide();
  mapboxgl.accessToken = 'pk.eyJ1IjoiaGljb29sa2lkMTIzMTIzMTIzIiwiYSI6ImNqbXBvdDc3aTB6NWozcXFrNXF3ZHdlcnMifQ.QsjiXm8MHW9c5x5xC4RMsg';

  let bounds = [
    [-100, 40.68392799015035], // Southwest coordinates
    [100, 40.87764500765852] // Northeast coordinates
  ];

  let startLongitude = -95.7129;
  let startLatitude = 37.0902;
  navigator.geolocation.getCurrentPosition(function(position) {
    startLongitude = position.coords.longitude;
    startLatitude = position.coords.latitude;
    // console.log("TRACKING ON: " + startLongitude);
    // console.log("TRACKING ON: " + startLatitude);
    map.easeTo({
      center: [startLongitude, startLatitude],
      zoom: 7
    });
  },
  function(error) {
    if (error.code == error.PERMISSION_DENIED){
      startLongitude = -95.7129;
      startLatitude = 37.0902;
    }
      console.error("Permission Denied");
  });
  let map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10', //hosted style id
    center: [startLongitude, startLatitude], // starting positions [negative longitude, latitude] [-95.7129, 37.0902]
    zoom:3,
    maxZoom:22,
    minZoom: 2,

    // maxBounds:bounds
  });
  map.on('load', function() {
    // console.log('loaded')
    map.doubleClickZoom.disable();

    map.addSource('hospitals', { // Hospitals
      type: 'geojson',

      data: toGeoJSON(JSON.parse(response[0])),
      cluster: true,
      clusterMaxZoom: 10, // Max zoom to cluster points on
      clusterRadius: 100 // Radius of each cluster when clustering points (defaults to 50)
    });
    map.addSource('coronacases', { // Coronavirus Cases
      type: 'geojson',

      data: covidGeoJSON(response2[0]),
    });

    map.addSource('district', { // Counties
      type: 'geojson',
      data: district22
    });
    map.addSource('states', {
      type: 'geojson',
      data: 'states.json'
    })
    map.addLayer({
      'id': 'district1',
      'type': 'fill',
      'source': 'district',
      'minzoom': 5,
      layout: {
        // 'text-field': 'Hospitals',
        // 'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        // 'text-size': 12
      },
      'paint': {
        // 'line-width':1,
        // 'line-color':'#ffffff'
        'fill-color':'#ffffff',
        'fill-opacity':0.00000000000000000001
      }
    });
    map.addLayer({
      'id': 'district1_lines',
      'type': 'line',
      'source': 'district',
      'minzoom': 5,
      'layout': {},
      'paint': {
        'line-width':1,
        'line-color':'rgba(100,100,100,1)'
      }
    });
    map.addLayer({
      'id': 'states_lines',
      'type': 'line',
      'source': 'states',
      'minzoom': 5,
      layout: {},
      'paint': {
        'line-width':1,
        'line-color':'rgba(150,150,160,1)'
      }
    })
    //Label state counties on click with tooltip
    function coronacases_county(county){
      let cases = map.getSource('coronacases')._data.features

      let covcases = 0
      let i = 0
      for (cov of cases){
        let n = new Date();
        let daysApart = Math.abs((n.getTime() - new Date(cov.properties.Date).getTime()) / (1000*60*60*24));
        if (daysApart <= 2.1){ // (change if needed lol) !IMPORTANT
          function isCounty(lat, lon, countyShape) {
            let point = turf.point([lon,lat])
            let polygon = turf.polygon(countyShape)
            return turf.booleanPointInPolygon(point, polygon)
          }
          let countyInfo = isCounty(cov.properties.Lat, cov.properties.Lon, county.geometry.coordinates)

          if (countyInfo){ //Denver, DENVER
            covcases += cov.properties.Cases
          }
          }
        }
        return covcases
      }

    map.on('dblclick', 'district1', function(e) {
      if (true) {
        let p = new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`${e.features[0].properties.NAME}: ${coronacases_county(e.features[0])} Cases  `);
        p.addTo(map);
      }
    });
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'hospitals',
      filter: ['>', 'point_count', 5],
      paint: {

        'circle-color': [
          'step', ['get', 'point_count'],
          // '#51bbd6', 100, '#f1f075', 750, '#f28cb1'
          'rgba(0,255,0,0.5)', 100, 'rgba(0,255,255,0.5)', 500, 'rgba(0,0,255,0.5)'
        ],
        'circle-radius': [
          'step', ['get', 'point_count'], 40, 100, 80, 500, 120
        ]
      }
    });

    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'hospitals',
      filter: ['>', 'point_count', 5], // ['has', 'point_count']
      layout: {
        'text-field': '{point_count_abbreviated} Hospitals',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      }
    });
    // ./cross.svg
    map.loadImage('./cross.png', function(error, image) {
      if (error) throw error;
      map.addImage('cross', image);
    })
    map.addLayer({
      id: 'unclustered-point',
      type: 'symbol',
      source: 'hospitals',
      filter: ['!', ['has','point_count']],
      layout: {
        'icon-image': 'cross',
        'icon-size':1
        // 'icon-color': 'red'
        // 'circle-color': '#11b4da',
        // 'circle-radius': 10,
        // 'circle-stroke-width': 1,
        // 'circle-stroke-color': '#fff'
      }
    });

    // inspect a cluster on click
    map.on('click', 'clusters', function(e) {
      let features = map.queryRenderedFeatures(e.point, {
        layers: ['clusters']
      });
      let clusterId = features[0].properties.cluster_id;
      map.getSource('hospitals').getClusterExpansionZoom(
      clusterId,
      function(err, zoom) {
        if (err) return;
          map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom
          });

        }
      );
    });
    map.addLayer({
      'id': 'places',
      'type': 'symbol',
      'source': 'hospitals',
      'layout': {
        'icon-image': '{icon}-15',
        'icon-allow-overlap': true
      }
    });

  let popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: true
  });

  map.on('mouseenter', 'places', function(e) {
    map.getCanvas().style.cursor = 'pointer';

    let coordinates = e.features[0].geometry.coordinates.slice();
    let description = e.features[0].properties.description;


    popup
      .setLngLat(coordinates)
      .setHTML(description)
      .addTo(map);
    });

    map.on('mouseleave', 'places', function() {
    map.getCanvas().style.cursor = '';
    popup.remove();
  });


    function htmlString(attrs, latitude, longitude,cov_nums) {
      let string = '';
      string += "<h3 class='title-case'>"+titleCase(attrs.NAME)+"</h3>"
      string += "<h4>Contact Info</h4>"
      string += `<h5>Phone Number: ${attrs.TELEPHONE}</h5>`
      string += `<h5>Website: <a href="${attrs.WEBSITE}" target="_blank">${attrs.WEBSITE}</a></h5>`
      string += `<h5>Address: ${attrs.ADDRESS}, ${attrs.CITY}, ${attrs.STATE} ${attrs.ZIP}</h5>`
      string += '<br>'
      string += '<h4>Statistics</h4>'
      string += attrs.BEDS == -999 ? `<h5>Unknown beds</h5>`:`<h5><b>${attrs.BEDS}</b> beds</h5>`
      string += `<h5><b>${cov_nums}</b> cases nearby<h5>`
      string += getRiskString(attrs.BEDS, cov_nums,get_beds_nearby(latitude, longitude, map.getSource('hospitals')._data.features))
      return string
    }


    function mapOnClick(latitude, longitude, attrs) {
      let cases = map.getSource('coronacases')._data.features
      let covcases = 0
      let i = 0
      for (cov of cases){
        let n = new Date();
        let daysApart = Math.abs((n.getTime() - new Date(cov.properties.Date).getTime()) / (1000*60*60*24));
        if (daysApart <= 2.1){
          let countyInfo = isClose(cov.properties.Lat, cov.properties.Lon, latitude, longitude)
            if (countyInfo){ //Denver, DENVER
              covcases += cov.properties.Cases
            }
          }
          i += 1;


        if (i+1 == cases.length) {

        new mapboxgl.Popup()
        .setLngLat([longitude, latitude])
        .setHTML(htmlString(attrs, latitude, longitude,covcases))
        .addTo(map);
}


};
        // Add all hospitals in area (beds)
        // Get all covid patients in area
        // 12% of people with covid need beds
        // (covid patients * 0.12)/# of beds in the area
        // HOSPITAL OVERFLOW RISK:
        // if number > 1 DISASTER.
        // if number between 0.8-1 HIGH RISK
        // else if between 0.5-0.8 MODERATE RISK
        // else if 0-0.5 Low RISK
      }

    map.on('click', 'unclustered-point', function(e) {
      let lat = e.lngLat.lat
      let lon = e.lngLat.lng
      let attrs = JSON.parse(e.features[0].properties.attributes)

      mapOnClick(lat, lon, attrs)
    });

      map.on('mouseenter', 'clusters', function() {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters', function() {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'unclustered-point', function() {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'unclustered-point', function() {
        map.getCanvas().style.cursor = '';
      });

      //UI Stuff-----------------------------------------------------------------------------------------------------------------------------------------

      $("body").mousemove(function(e){

        if(e.pageY <= 70 && $("h1").css("opacity") <= 0.2){
          $("#heading").css("z-index","0");
        } else if(e.pageY > 70) {
          $("#heading").css("z-index","9999");
        }
      });
      let searchHidden = true;

      $("#search").click(function(){
        $("#search-text").hide();
        $("#search-input").show().focus();
        $("#search-close").show();
        $("#result-container").show();
        $(this).addClass("searching");
        searchHidden = false;
      });

      $("#search-close").click(function(e){
        closeSearch(e);
      });

      appendAll();

      $(".search-result").click(function(){
        let hospitals = map.getSource('hospitals')._data.features;
        let thisResult = $(this);
        hospitals.forEach(function(el){
          if(el.properties.attributes.NAME.toLowerCase() == thisResult.text().toLowerCase()){
            map.easeTo({
              center: [el.properties.attributes.LONGITUDE,el.properties.attributes.LATITUDE],
              zoom: 13
            });
            mapOnClick(el.properties.attributes.LATITUDE,el.properties.attributes.LONGITUDE, el.properties.attributes);
          }
        });
      });

      function closeSearch(e){
        e.stopPropagation();
        $("#search-text").show();
        $("#search-input").hide().val("");
        $("#search-close").hide();
        $("#result-container").hide();
        $("#search").removeClass("searching");
        searchHidden = true;
      }

      $("#search-input").on("change keyup paste",function(){
        if($("#search-input").val() != ""){
          searchFor($("#search-input").val().toLowerCase());
        } else {
          $(".search-result").addClass("hidden");
        }
      });

      function appendAll(){ //
        let hospitals = map.getSource('hospitals')._data.features;
        hospitals.forEach(function(element){
          try {
            $("#result-container").append(`<div class="search-result hidden">${titleCase(element.properties.attributes.NAME)}</div>`);
          } catch(e){
            console.warn(element) // something like ""PROVIDENCE REGIONAL MEDICAL CENTER  - COLBY"" Theres a dash. (Should be fixed)
          }

        });
      }
      function searchFor(item){
        let cases = map.getSource('coronacases')._data.features;

        $(".search-result").each(function(e){
          if($(this).text().toLowerCase().includes(item.toLowerCase())){
            $(this).removeClass("hidden");
          } else {
            $(this).addClass("hidden");
          }
        });
      }
      map.on('mouseenter', 'clusters', function() {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters', function() {
        map.getCanvas().style.cursor = '';
      });
    });

    });

function titleCase(string) {
  let sentence = string.toLowerCase().split(/\s+/);
  for(let i = 0; i< sentence.length; i++){
    if (sentence[i][0].match(/[a-z]/i)) {
      sentence[i] = sentence[i][0].toUpperCase() + sentence[i].slice(1);
    }
  }
  return sentence.join(" ");
}

$(function(){
  $('#icon-close').click(function(){
    $('#modal-help').toggle();
  })

  $('#help-btn').click(function(){
    $('#modal-help').toggle();
  })

});
