let settings = {
  "url": "https://api.covid19api.com/country/us/status/confirmed/live",
  "method": "GET",
  "timeout": 0,
};
// atom://teletype/portal/70ce17da-332c-498c-8894-6d4ef48b15f1
// function getCoords(data) {
//   return [-data.Lon, data.Lat]
// }
function toGeoJSON(data) {
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
$.ajax(settings).done(function (response) {
  console.log(response);
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
    map.addSource('covid', {
      type: 'geojson',
      // Point to GeoJSON data. This example visualizes all M1.0+ earthquakes
      // from 12/22/15 to 1/21/16 as logged by USGS' Earthquake hazards program.
      data: toGeoJSON(response),
      cluster: true,
      clusterMaxZoom: 14, // Max zoom to cluster points on
      clusterRadius: 100 // Radius of each cluster when clustering points (defaults to 50)
    });

    map.addLayer({
      cases_inside:'',
      id: 'clusters',
      type: 'circle',
      source: 'covid',
      filter: ['>', 'point_count',20],
      paint: {
      // Use step expressions (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
      // with three steps to implement three types of circles:
      //   * Blue, 20px circles when point count is less than 100
      //   * Yellow, 30px circles when point count is between 100 and 750
      //   * Pink, 40px circles when point count is greater than or equal to 750
        'circle-color': [
          'step', ['get', 'point_count'],
          // '#51bbd6', 100, '#f1f075', 750, '#f28cb1'
          'rgba(255,255,0,0.5)', 100, 'rgba(255,127.5,0,0.5)', 750, 'rgba(255,0,0,0.5)'
        ],
        'circle-radius': [
          'step', ['get', 'point_count'], 30, 100, 60, 750, 90
        ]
      }
    });

    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'covid',
      filter: ['>', 'point_count', 20], // ['has', 'point_count']
      layout: {
        'text-field': '{point_count_abbreviated} Areas',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      }
    });

    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'covid',
      filter: ['<=','point_count',20],
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
      map.getSource('covid').getClusterExpansionZoom(
      clusterId,
      function(err, zoom) {
        if (err) return;
        function getCasesInside(id){
            getClusterExpansionZoom(id, (err,afunct)=>{
              for(f in afunct){
                let clusterId = f.features[0].properties.cluster_id
                let limt
                getClusterLeaves(clusterId, )
              }
            })
        }
        getCasesInside(clusterId)
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
      'source': 'covid',
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



    map.on('click', 'unclustered-point', function(e) {
      console.log(e)
      let coordinates =  e.features[0].geometry.coordinates.slice();
      // let features =  map.queryRenderedFeatures(e.point, { layers: ['unclustered-point'] });
      let clusterId =  e.features[0].properties.cluster_id
      let point_count =  e.features[0].properties.point_count
      let clusterSource =  map.getSource('covid');
      // console.log(clusterSource);
      console.log(clusterSource.getClusterLeaves(clusterId, point_count, 0 ))
      clusterSource.getClusterLeaves(clusterId, point_count, 0, (err,f)=>{
            let city = f[0].properties.Province
            let total_cases = 0
            for (fo of f) {
              console.log(fo);
              total_cases += fo.properties.Cases
              console.log(total_cases)
            }

              while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
              }

            new mapboxgl.Popup()
              .setLngLat(coordinates)
              .setHTML(`Area: ${city}<br>Cases: ${total_cases}`)
              .addTo(map);
            });

            map.on('mouseenter', 'clusters', function() {
              map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'clusters', function() {
              map.getCanvas().style.cursor = '';
            });
          });

      })
    });


//Hides header when hovered over so it doesn't get in the way
$(function(){
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
    searchHidden = false;
  });

  $("#search-close").click(function(e){
    e.stopPropagation();
    $("#search-text").show();
    $("#search-input").hide().val("");
    $("#search-close").hide();
    searchHidden = true;
  });

  $("#search-icon").click(function(){
    searchFor($("#search-input").val().toLowerCase());
  });

  function searchFor(item){

  }

});
