let hospitals = {
  "url": "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Hospitals_1/FeatureServer/0/query?where=1%3D1&outFields=OBJECTID,ID,NAME,LATITUDE,LONGITUDE,BEDS,TRAUMA,POPULATION,COUNTY,NAICS_CODE&outSR=4326&f=json",
  "method": "GET",
  "timeout": 0,
};
let coronacases = {
  "url": "https://api.covid19api.com/country/us/status/confirmed/live",
  "method": "GET",
  "timeout": 0,
};
// atom://teletype/portal/70ce17da-332c-498c-8894-6d4ef48b15f1
// function getCoords(data) {
//   return [-data.Lon, data.Lat]
// }
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
   console.log(geojson)
   return geojson
}
function toGeoJSON(data) {
  console.log(data)
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
   console.log(geojson)
   return geojson
}
function get_beds_nearby(hospital, hospitals, radius=0.5) {
  beds = 0
  console.log(hospital)
  for (h of hospitals) {
    // console.log(h);
    if (isClose(h.properties.attributes.LATITUDE, h.properties.attributes.LONGITUDE, hospital.lngLat.lat, hospital.lngLat.lng) && h.properties.attributes.BEDS != -999) {
      beds += h.properties.attributes.BEDS
    }
  }
  return beds
}
function getRiskString(hospital,near_cases, hospital_beds_nearby, percent_beds_taken = 0.5, percentage_hospitalized_need = 0.12){
    // Add all hospitals in area (beds)
    // Get all covid patients in area
    // 12% of people with covid need beds
    // (covid patients * 0.12)/# of beds in the area
    // HOSPITAL OVERFLOW RISK:
    // if number > 1 DISASTER.
    // if number between 0.8-1 HIGH RISK
    // else if between 0.5-0.8 MODERATE RISK
    // else if 0-0.5 Low RISK
    const selfBeds = JSON.parse(hospital.features[0].properties.attributes).BEDS
    if (selfBeds == -999) {
      return "Risk: Unknown"
  }
    console.log(hospital_beds_nearby)
    console.log(selfBeds)
    let available_beds = (1-percent_beds_taken)*(hospital_beds_nearby + selfBeds)
    console.log(available_beds)
    let hospitalized_need = percentage_hospitalized_need * near_cases;
    console.log(hospitalized_need)
    let risk_factor = hospitalized_need/available_beds
    let beds_for_low_risk = Math.round(hospitalized_need/0.5)
    let beds_for_moderate_risk = Math.round(hospitalized_need / 0.8)
    let beds_for_high_risk = Math.round(hospitalized_need)
    console.log(risk_factor)
    if(risk_factor >= 1){
      return `Risk: EXTREME <br> Beds needed to reduce danger to... <br> HIGH RISK: ${beds_for_high_risk} <br> MODERATE RISK: ${beds_for_moderate_risk} <br> LOW RISK: ${beds_for_low_risk}`

    } else if(risk_factor <= 0.8 && risk_factor >= 0.5){
      return `Risk: MODERATE <br> Beds needed to reduce danger to... <br> LOW RISK: ${beds_for_low_risk}`
    } else if(risk_factor > 0.8) {
      return `Risk: HIGH <br> Beds needed to reduce danger to ... <br> MODERATE RISK: ${beds_for_moderate_risk} <br> LOW RISK: ${beds_for_low_risk}`
    } else {
      return "Risk: LOW "
    }

  }
function coronacases_county(){

}
// }
let response = $.ajax(hospitals);
let response2 = $.ajax(coronacases);
$.when(response, response2).then(function(response, response2) {
  console.log(response);
  console.log(response2)
  mapboxgl.accessToken = 'pk.eyJ1IjoiaGljb29sa2lkMTIzMTIzMTIzIiwiYSI6ImNqbXBvdDc3aTB6NWozcXFrNXF3ZHdlcnMifQ.QsjiXm8MHW9c5x5xC4RMsg';

  let bounds = [
    [-100, 40.68392799015035], // Southwest coordinates
    [100, 40.87764500765852] // Northeast coordinates
  ];
  let map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v10', //hosted style id
    center: [-95.7129, 37.0902], // starting positions [negative longitude, latitude]
    zoom:3,
    maxZoom:22,
    minZoom: 2,
    // maxBounds:bounds
  });
  map.on('load', function() {
    // Add a new source from our GeoJSON data and
    // set the 'cluster' option to true. GL-JS will
    // add the point_count property to your source data.
    map.addSource('hospitals', { // Hospitals
      type: 'geojson',
      // Point to GeoJSON data. This example visualizes all M1.0+ earthquakes
      // from 12/22/15 to 1/21/16 as logged by USGS' Earthquake hazards program.
      data: toGeoJSON(JSON.parse(response[0])),
      cluster: true,
      clusterMaxZoom: 10, // Max zoom to cluster points on
      clusterRadius: 100 // Radius of each cluster when clustering points (defaults to 50)
    });
    map.addSource('coronacases', { // Coronavirus Cases
      type: 'geojson',
      // Point to GeoJSON data. This example visualizes all M1.0+ earthquakes
      // from 12/22/15 to 1/21/16 as logged by USGS' Earthquake hazards program.
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
      'layout': {},
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
        'line-color':'#bababa'
      }
    });
    map.addLayer({
      'id': 'states_lines',
      'type': 'line',
      'source': 'states',
      'minzoom': 5,
      'layout': {},
      'paint': {
        'line-width':1,
        'line-color':'#354255'
      }
    })
    //Label state counties on click with tooltip
    console.log(map.getSource('district'));
    map.on('click', 'district1', function(e) {
      console.log(e);
      new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(e.features[0].properties.NAME)
      .addTo(map);
    });
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'hospitals',
      filter: ['has', 'point_count'],
      paint: {
      // Use step expressions (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
      // with three steps to implement three types of circles:
      //   * Blue, 20px circles when point count is less than 100
      //   * Yellow, 30px circles when point count is between 100 and 750
      //   * Pink, 40px circles when point count is greater than or equal to 750
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
      filter: ['has', 'point_count'], // ['has', 'point_count']
      layout: {
        'text-field': '{point_count_abbreviated} Hospitals',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      }
    });

    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'hospitals',
      filter: ['!', ['has','point_count']],
      paint: {
        'circle-color': '#11b4da',
        'circle-radius': 10,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff'
      }
    });
    console.log(map)

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
        // function getCasesInside(id){
        //     getClusterExpansionZoom(id, (err,afunct)=>{
        //       for(f in afunct){
        //         let clusterId = f.features[0].properties.cluster_id
        //         let limt
        //         getClusterLeaves(clusterId, )
        //       }
        //     })
        // }
        // getCasesInside(clusterId)
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

  //Create a popup, but don't add it to the map yet.
  var popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
  });

  map.on('mouseenter', 'places', function(e) {
  // Change the cursor style as a UI indicator.
    map.getCanvas().style.cursor = 'pointer';

    var coordinates = e.features[0].geometry.coordinates.slice();
    var description = e.features[0].properties.description;

    // Ensure that if the map is zoomed out such that multiple
    // copies of the feature are visible, the popup appears
    // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
  }

    // Populate the popup and set its coordinates
    // based on the feature found.
    popup
      .setLngLat(coordinates)
      .setHTML(description)
      .addTo(map);
    });

    map.on('mouseleave', 'places', function() {
    map.getCanvas().style.cursor = '';
    popup.remove();
  });

    // When a click event occurs on a feature in
    // the unclustered-point layer, open a popup at
    // the location of the feature, with
    // description HTML from its properties.


    function htmlString(attrs, e,cov_nums) {
      let string = '';
      string += "<span class='title-case'>"+titleCase(attrs.NAME)+"</span>"
      string += ` <span class="material-icons">local_hospital</span>`
      string += '<br>'
      string += attrs.BEDS == -999 ? `Unknown beds`:`${attrs.BEDS} beds`
      string += '<br>'
      string += `${cov_nums} cases nearby`
      string += '<br>'
      string += getRiskString(e, cov_nums,get_beds_nearby(e, map.getSource('hospitals')._data.features))
      return string
    }

    function mapOnClick(e) {
      console.log(e)
      let coordinates = e.features[0].geometry.coordinates.slice();
      // let features =  map.queryRenderedFeatures(e.point, { layers: ['unclustered-point'] });
      // let clusterId =  e.features[0].properties.cluster_id
      // let point_count =  e.features[0].properties.point_count
      // console.log(clusterSource);
      let attrs = JSON.parse(e.features[0].properties.attributes)
      let cases = map.getSource('coronacases')._data.features
      // console.log(cases)

      function getCounty(){
        let setting = {
          "url": "https://api.covid19api.com/country/us/status/confirmed/live",
          "method": "GET",
          "timeout": 0,
        }
      }
      let covcases = 0
      let i = 0
      for (cov of cases){
        // console.log(cov)
        // COMBAK:
        //"2020-03-28"
        //cov.properties.Date
        let n = new Date();
        // console.log(new Date((cov.properties.Date.toString()).slice(0,10)).setHours(0,0,0,0))
        // console.log(new Date().setHours(0,0,0,0))
        // console.log((cov.properties.Date).slice(0,10))
        // console.log(n.toISOString().slice(0,10))
        // console.log(new Date(cov.properties.Date))
        // console.log(n);
        let daysApart = Math.abs((n.getTime() - new Date(cov.properties.Date).getTime()) / (1000*60*60*24));
        // console.log(daysApart)

        if (daysApart <= 3){
          console.log('yes')
          // console.log(cov.properties );
          let countyInfo = isClose(cov.properties.Lat, cov.properties.Lon, attrs.LATITUDE, attrs.LONGITUDE)
            // console.log(countyInfo)
            if (countyInfo){ //Denver, DENVER
              console.log('yes2')
              covcases += cov.properties.Cases
              // console.log(cov.properties)
            }
          }
          i += 1;


        if (i+1 == cases.length) {
          // console.log(covcases)
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }


        new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(htmlString(attrs, e,covcases))
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

    map.on('click', 'unclustered-point', mapOnClick);
//     function(e) {
//       console.log(e)
//       let coordinates = e.features[0].geometry.coordinates.slice();
//       // let features =  map.queryRenderedFeatures(e.point, { layers: ['unclustered-point'] });
//       // let clusterId =  e.features[0].properties.cluster_id
//       // let point_count =  e.features[0].properties.point_count
//       // console.log(clusterSource);
//       let attrs = JSON.parse(e.features[0].properties.attributes)
//       let cases = map.getSource('coronacases')._data.features
//       // console.log(cases)
//
//       function getCounty(){
//         let setting = {
//           "url": "https://api.covid19api.com/country/us/status/confirmed/live",
//           "method": "GET",
//           "timeout": 0,
//         }
//       }
//       let covcases = 0
//       let i = 0
//       for (cov of cases){
//         // console.log(cov)
//         // COMBAK:
//         //"2020-03-28"
//         //cov.properties.Date
//         let n = new Date();
//         // console.log(new Date((cov.properties.Date.toString()).slice(0,10)).setHours(0,0,0,0))
//         // console.log(new Date().setHours(0,0,0,0))
//         // console.log((cov.properties.Date).slice(0,10))
//         // console.log(n.toISOString().slice(0,10))
//         // console.log(new Date(cov.properties.Date))
//         // console.log(n);
//         let daysApart = Math.abs((n.getTime() - new Date(cov.properties.Date).getTime()) / (1000*60*60*24));
//         // console.log(daysApart)
//
//         if (daysApart <= 3){
//           console.log('yes')
//           // console.log(cov.properties );
//           let countyInfo = isClose(cov.properties.Lat, cov.properties.Lon, attrs.LATITUDE, attrs.LONGITUDE)
//             // console.log(countyInfo)
//             if (countyInfo){ //Denver, DENVER
//               console.log('yes2')
//               covcases += cov.properties.Cases
//               // console.log(cov.properties)
//             }
//           }
//           i += 1;
//
//
//         if (i+1 == cases.length) {
//           // console.log(covcases)
//         while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
//           coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
//         }
//
//
//         new mapboxgl.Popup()
//         .setLngLat(coordinates)
//         .setHTML(htmlString(attrs, covcases))
//         .addTo(map);
// }
//
//
// };
//         // Add all hospitals in area (beds)
//         // Get all covid patients in area
//         // 12% of people with covid need beds
//         // (covid patients * 0.12)/# of beds in the area
//         // HOSPITAL OVERFLOW RISK:
//         // if number > 1 DISASTER.
//         // if number between 0.8-1 HIGH RISK
//         // else if between 0.5-0.8 MODERATE RISK
//         // else if 0-0.5 Low RISK
//       }

      map.on('mouseenter', 'clusters', function() {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters', function() {
        map.getCanvas().style.cursor = '';
      });

      //UI Stuff-----------------------------------------------------------------------------------------------------------------------------------------

      $("body").mousemove(function(e){
        if(e.pageY <= 70 && $("h1").css("opacity") <= 0.2){
          $("#heading").css("z-index","0");
        } else if(e.pageY > 70) {
          // $("h1").css("opacity","0.2");
          // $("h1").css("opacity","1");
          $("#heading").css("z-index","9999");
        }
      });
      // $("h1").on("mouseenter",function(){
      //   console.log();
      //   $(this).css("z-index","0");
      // });
      // $("h1").on("mouseleave",function(){
      //   $(this).css("z-index","9999");
      // });
      // $("h1").on("mouseover",function(){
      //   $(this).css("opacity"))
      // });
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
        // $(this).text().toLowerCase()
        let thisResult = $(this);
        hospitals.forEach(function(el){
          if(el.properties.attributes.NAME.toLowerCase() == thisResult.text().toLowerCase()){
            map.easeTo({
              center: [el.properties.attributes.LONGITUDE,el.properties.attributes.LATITUDE],
              zoom: 17
            });
            mapOnClick(el);
            // break;
          }
        });
        // map.easeTo({
        //   center: features[0].geometry.coordinates,
        //   zoom: zoom
        // });
      });
      // map.on("click", function(){
      //   closeSearch();
      // });

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
      // $("#search-icon").click(function(){
      //   searchFor($("#search-input").val().toLowerCase());
      // });
      function appendAll(){ //
        let hospitals = map.getSource('hospitals')._data.features;
        hospitals.forEach(function(element){
          // console.log(element.properties.attributes.NAME);
          try {
            $("#result-container").append(`<div class="search-result hidden">${titleCase(element.properties.attributes.NAME)}</div>`);
          } catch(e){
            console.warn("Empty Data");
            console.warn(element) // something like ""PROVIDENCE REGIONAL MEDICAL CENTER  - COLBY"" Theres a dash.
            // console.warn(element);
            // console.warn(e);
            // try {
            //   $("#result-container").append(`<div class="search-result hidden">`+titleCase(e.properties.attributes.name)+`</div>`);
            // } catch (e) {
            //
            // }
            // if(e.name == "TypeError"){
            //
            // }
          }

          // if(e.properties.attributes.NAME.toLowerCase().includes(item)){
          //   $("#result-container").append(`<div class="search-result">`+titleCase(e.properties.attributes.NAME)+`</div>`)
          // }
        });
      }
      function searchFor(item){
        let cases = map.getSource('coronacases')._data.features;
        // let data = cases + hospitals;
        // console.log(data);
        // cases.forEach(function(e){
        //   // console.log("e is " +e);
        //   // console.log("e.properties is " +e.properties);
        //   // console.log("e.properties.province is " +e.properties.Province);
        //   // console.log("e is " +e.properties.Province.toLowerCase());
        //   if(e.properties.Province.toLowerCase().includes(item)){
        //     $("#result-container").append(`<div class="search-result">`+e.properties.Province+`</div>`)
        //   }
        // });
        $(".search-result").each(function(e){
          // $("#result-container").scrollTop($("#result-container")[0].scrollHeight);
          if($(this).text().toLowerCase().includes(item.toLowerCase())){
            $(this).removeClass("hidden");
          } else {
            $(this).addClass("hidden");
          }
        });
        // properties.
        // response2.features.properties.
      }
    });

    });

//Title Case Tutorials point
function titleCase(string) {
  let sentence = string.toLowerCase().split(/\s+/);
  for(let i = 0; i< sentence.length; i++){
    if (sentence[i][0].match(/[a-z]/i)) {
      sentence[i] = sentence[i][0].toUpperCase() + sentence[i].slice(1);
    }
  }
  // document.write(sentence.join(" "));
  // console.warn(sentence)
  return sentence.join(" ");
}
//Hides header when hovered over so it doesn't get in the way
$(function(){


});
