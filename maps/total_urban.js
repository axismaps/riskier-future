(function(){
  var width = 1000,
     height = 560;

  var frame = d3.select(".iframe")
    .insert("div",".play")
    .attr("class","frame")
    .attr("id","total-urban")
    .attr("name","total_urban");

  var svg = frame
    .append( "svg" )
    .attr( "class", "YlGnBu" )
    .attr( "width", width )
    .attr( "height", height );

  var boundary = svg.append("g")
      .attr( "id", "boundary" );

  var countries = svg.append( "g" )
    .attr( "id", "countries" );

  var propSymbols = svg.append( "g" )
    .attr( "id", "symbols" );

  var mask = svg.append( "rect" )
    .attr({
      x: 0,
      y: height-105,
      width: width,
      height: 105
    })
    .attr( "fill", "rgba(0,0,0,.5)" );

  var projection = d3.geo.times()
    .center([0,5])
    .rotate( [-25,0])
      .scale(250)
      .translate([width / 2, height / 2])
      .precision(.1);

  var path = d3.geo.path()
    .projection( projection );

  var duration = 150;

  var jsonData,
    csvData,
    centroids;

  var urbanTotal,
    ruralTotal;

  var minYear = 1960,
    maxYear = 2013,
    currentYear = 1960;

  var animationInterval;

  var boundaryFeature = {type:"Feature",geometry:{
    type: "Polygon",
    coordinates: [[
      [-180,89.99],
      [180,89.99],
      [180,-89.99],
      [-180,-89.99],
      [-180,89.99]
    ]]
  }};

 // d3.select( "header" ).style( "width", width + "px" );

  var symbolScale = d3.scale.sqrt()
    .domain( [1000000,1000000000] )
    .range( [3,40] );


  queue()
    .defer( d3.json, "data/json/admin0_ms1.json" )
    .defer( d3.json, "data/json/disputed.geojson" )
    .defer( d3.json, "data/json/centroids.geojson" )
    .defer( d3.csv, "data/csv/percent_urban.csv" )
    .defer( d3.csv, "data/csv/urban_total.csv" )
    .defer( d3.csv, "data/csv/rural_total.csv" )
    .await( function( err, json, disp, cent, csv, urban, rural ){
      jsonData = json;
      jsonData.features = jsonData.features.concat( disp.features );
      csvData = csv;
      centroids = cent;
      urbanTotal = _.indexBy( urban, "Country Code" );
      ruralTotal = _.indexBy( rural, "Country Code" );
      createMap();

      frame.on( "click", function(){
        if ( !frame.node().isPlaying ) frame.node().play();
        else frame.node().pause();
      })
    });

  function createMap(){
    _.each( urbanTotal, function(row){
      _.each( centroids.features, function(f){
        if ( f.properties.code == row["Country Code"] ){
          f.properties.data = row;
        }
      });
    });

    boundary
      .append( "path" )
      .datum( boundaryFeature )
      .attr( "d", path )
      .on( "mouseover", function(){
        frame.selectAll(".highlight").classed("highlight",false);
          probe.style("display","none");
      });

    countries.selectAll( "path" )
      .data( jsonData.features )
      .enter()
      .append( "path" )
      .attr( "d", path );

    var symb = propSymbols.selectAll( "g" )
      .data( centroids.features )
      .enter()
      .append( "g" )
      .attr( "transform", function(d){
        return "translate(" + projection(d.geometry.coordinates).toString() + ")";
      })
      .on( "mouseover", function(d){
        frame.selectAll("highlight").classed("highlight",false);
        d3.select(this).classed("highlight",true);
        probe.datum(d)
          .html(
            "<p>" + d.properties.WB_ADM0_NA + "</p>" +
            "<p>Urban: " + format(parseInt(urbanTotal[ d.properties.code ][currentYear >= minYear ? currentYear : maxYear])) + "</p>" +
            "<p>Rural: " + format(parseInt(ruralTotal[ d.properties.code ][currentYear >= minYear ? currentYear : maxYear])) + "</p>"
          )
          .style("display","block");
      })
      .on("mousemove",function(d){
        var m = d3.mouse(frame.node())
        var t = m[1] - probe.node().offsetHeight - 5;
        if ( t <= 0 ) t+= probe.node().offsetHeight + 10;
        var l = m[0] + 5;
        if ( l + probe.node().offsetWidth > width ) l -= probe.node().offsetWidth + 10;
        probe.style({
          top: t + 'px',
          left: l + 'px'
        });
      })
      .on("mouseout",function(){
        frame.selectAll("highlight").classed("highlight",false);
        probe.style("display","none");
      })
      .sort(function(a,b){
        try{
          var aVal = parseInt(urbanTotal[ a.properties.code ][maxYear]) + parseInt(ruralTotal[ a.properties.code ][maxYear]);
        var bVal = parseInt(urbanTotal[ b.properties.code ][maxYear]) + parseInt(ruralTotal[ b.properties.code ][maxYear]); 
        }
        catch( e ) {
          return 0;
        }
        return  bVal - aVal;
      })

    var probe = frame.append( "div" ).attr( "id","probe" );
    var format = d3.format(",");

    symb.append( "path" ).attr("class","urban")
    symb.append( "path" ).attr("class","rural");

    createLegend();
    createChart();
    createTimeline();

    svg.append( "rect" )
      .attr( "id", "interaction" )
      .attr( "transform", "translate(180," + (height-75) + ")" )
      .attr( "fill", "rgba(0,0,0,0)" )
      .attr({
        x: 0,
        y: 0,
        width: width-230,
        height: 75
      })
      .on( "click", function(){
        d3.event.stopPropagation();
        var x = d3.mouse(this)[0],
          yearWidth = (width-230)/(maxYear-minYear),
          yearDelta = Math.round( x / yearWidth );
        goToFrame( minYear + yearDelta );
        if ( !frame.node().isPlaying ) frame.node().play();
      });
    
    

    goToFrame( currentYear );
    //frame.node().play();

  }
  var pie = d3.layout.pie().sort(null);
  function updateSymbols( fieldName, tween ){
    
    propSymbols.selectAll( "g" )
      .each( function(d){
        if ( !d.properties.data ) return;
        var total = parseInt(urbanTotal[ d.properties.code ][fieldName]) + parseInt(ruralTotal[ d.properties.code ][fieldName]);
        if ( isNaN(total) ) return;
        var data = [ Math.round(100*urbanTotal[ d.properties.code ][fieldName]/total)/100, Math.round(100*ruralTotal[ d.properties.code ][fieldName]/total)/100 ];
        
        var r = Math.round( 10 * symbolScale( total ) ) / 10;
        var arc = d3.svg.arc().outerRadius(r);
        d3.select(this) 
          .selectAll( "path" )
          .data( pie( data ) )
          .attr( "d",arc )
      });
      
    if ( tween ) setTimeout( function(){ frame.select( "#year" ).text( fieldName ) }, duration );
    else frame.select( "#year" ).text( fieldName )

    frame.select("#probe")
      .html(function(d){
        if ( !d ) return "";
        return "<p>" + d.properties.WB_ADM0_NA + "</p><p>Urban: " + d3.format(",")(parseInt(urbanTotal[ d.properties.code ][currentYear])) + "</p><p>Rural: " + d3.format(",")(parseInt(ruralTotal[ d.properties.code ][currentYear])) + "</p>"
      })
  }

  function createLegend(){
    var sizes = [10000000,100000000,250000000,500000000,1000000000];
    var max = symbolScale( sizes[sizes.length-1] );
    var legendLabels = frame.select( "header" )
      .append ( "svg" )
      .attr( "width", 40 )
      .attr( "height", max * 2 + 10 )
    var legend = frame.select( "header" )
      .append ( "svg" )
      .attr( "width", max )
      .attr( "height", max * 2 + 10 )
      .append( "g" )
      .attr( "id", "legend" );
    for ( var i= sizes.length-1; i>=0; i-- ){
      legend.append( "circle" )
        .attr( "cx", max )
        .attr( "cy", max * 2 - symbolScale( sizes[i] ) + 5 )
        .attr( "r", symbolScale( sizes[i] ) )
    }
    
    for ( var i in sizes ){
      legendLabels.append( "text" )
        .text( sizes[i] >= 1000000000 ? sizes[i]/1000000000 + "b" : sizes[i]/1000000 + "m" )
        .attr( "font-size", 12 )
        .attr( "dominant-baseline", "middle" )
        .attr( "x", 0)
        .attr( "y", 2* (max - symbolScale( sizes[i] )) + 5 )
    }
  }

  function createTimeline(){
    var timeline = svg.append("g")
      .attr( "id", "timeline" )
      .attr( "transform", "translate(180," + (height-75) + ")" );
    
    timeline.append( "rect" )
      .attr( "id", "progress" )
      .attr( "x", 0 )
      .attr( "y", 0 )
      .attr( "height", 75);
    
    var yearWidth = (width-230)/(maxYear-minYear);
    for ( var year = minYear; year <= maxYear; year++ ){
      var bigTick = year == minYear || year == maxYear || year % 10 == 0,
        x = (year-minYear)*yearWidth;
      if ( !bigTick ) continue;
      timeline.append( "line" )
        .attr("x1", x )
        .attr("y1", 0 )
        .attr("x2", x )
        .attr("y2", bigTick ? 75 : 5 );
      if ( bigTick && 
        ( Math.abs( year-minYear ) > 3 && Math.abs( maxYear - year ) > 3 || year == maxYear )  ){
        timeline.append( "text" )
          .attr("x",x)
          .attr("y",-5)
          .attr("text-anchor","middle")
          .attr("font-size",24)
          .text(year)
      }
    }

    timeline.append( "text" )
      .attr( "id", "year" )
      .attr( "x", -170 )
      .attr( "y", 45 )
      .attr( "dominant-baseline", "middle")
  }

  function updateTimeline( tween ){
    var yearWidth = (width-230)/(maxYear-minYear);
    if ( tween ){
      frame.select( "#progress" )
        .transition()
        .duration( tween ? duration : 10 )
        .ease( "linear" )
        .attr( "width", (currentYear-minYear) * yearWidth );
    } else {
      frame.select( "#progress" )
        .attr( "width", (currentYear-minYear) * yearWidth );
    }
  }

  function createChart(){
    svg.append( "g" )
      .attr( "id", "chart" )
      .attr( "transform", "translate(180," + (height-75) + ")" );
    drawChart( "WLD" );
  }

  function drawChart( id ){
    var urban = urbanTotal[ id ];
    var rural = ruralTotal[ id ];


    var max = ( parseInt(urban[maxYear]) + parseInt(rural[maxYear]) ) * 1.05;
    var chartScale = d3.scale.linear()
      .domain( [0,max] )
      .range( [75,0] );
    var yearWidth = (width-230)/(maxYear-minYear);
    var dUrban = "",
      dRural = "";
    frame.selectAll( "#chart path" ).remove();
    frame.select( "#chart rect" ).remove();
    frame.select( "#chart g" ).remove();
    for ( year=minYear; year<=maxYear; year++ ){
      if ( year == minYear ){
        command = "M";
      } else {
        command = "L";
      }
    
      dUrban += command + Math.round( (year-minYear)*yearWidth ) + " " + chartScale(urban[year]);
      dRural += command + Math.round( (year-minYear)*yearWidth ) + " " + chartScale(parseInt(urban[year]) + parseInt(rural[year]))
    }
    dUrban += "V" + chartScale.range()[0] + "H0Z";
    dRural += "V" + chartScale.range()[0] + "H0Z";

    frame.select( "#chart" )
      .append( "path" )
      .attr( "class", "rural" )
      .attr( "d", dRural )

    frame.select( "#chart" )
      .append( "path" )
      .attr( "class", "urban" )
      .attr( "d", dUrban )
    

    var axis = d3.svg.axis()
      .scale( chartScale )
      .orient( "right" )
      .ticks(3)
      .innerTickSize( (width-230) )
      .outerTickSize( (width-230) )
      .tickFormat( function(d){
        if ( d ==0 ) return "";
        if ( d >= 1000000000 ) return d / 1000000000 + "b"
        return d/1000000 + "m"
      });

    frame.select( "#chart" )
      .append( "g" )
      .attr( "id", "axis" )
      .call( axis );

    frame.selectAll( ".tick text" ).attr( "dy", 0 );

    frame.select( "#chart" )
      .append( "rect" )
      .attr({
        x: -25,
        y: -25,
        width: 15,
        height: 15,
        class: "urban"
      });
    frame.select( "#chart" )
      .append( "text" )
      .text( "urban" )
      .attr({
        x: -5,
        y: -10
      });

    frame.select( "#chart" )
      .append( "rect" )
      .attr({
        x: 50,
        y: -25,
        width: 15,
        height: 15,
        class: "rural"
      });

    frame.select( "#chart" )
      .append( "text" )
      .text( "rural" )
      .attr({
        x: 70,
        y: -10
      });

    frame.select( "#chart" )
      .append( "text" )
      .attr( "id", "chart-title" )
      .attr( "x", -175 )
      .attr( "y", -10 )
      .text( urban["Country Name"] + " Population" );
  }

  function showFlag(){
    var chartScale = d3.scale.linear()
      .domain( [0,100] )
      .range( [75,0] );
    var yearWidth = (width-230)/(maxYear-minYear);

    frame.select( "#chart" )
      .append( "line" )
      .attr({
        x1: (2007-minYear) * yearWidth,
        x2: (2007-minYear) * yearWidth,
        y1: chartScale(50),
        y2: -130
      })
      .attr( "stroke", "black" )
      .attr( "class", "flag" )
    
    frame.select( "#chart" )
      .append( "rect" )
      .attr({
        x: (2007-minYear) * yearWidth,
        y: -130,
        width: 140,
        height: 85,
        fill: "rgba(0,0,0,.75)"
      })
      .attr( "class", "flag" )

    var flag = frame.select("#chart")
      .append( "text" )
      .attr({
        x: (2007-minYear) * yearWidth + 5,
        y: -109
      })
      .attr( "class", "flag" )
    flag.append( "tspan" )
      .text( "2007" )
      .attr( "font-size", "1.4em")
      
    flag.append( "tspan" )
      .text( "More than 50% of the ")
      .attr( "dy", 20)
      .attr("x",(2007-minYear) * yearWidth + 5)
      .attr( "font-size", "14px")
    flag.append( "tspan" )
      .text( "world now lives in")
      .attr( "dy", 16)
      .attr("x",(2007-minYear) * yearWidth + 5)
      .attr( "font-size", "14px")
    flag.append( "tspan" )
      .text( "urban areas.")
      .attr( "dy", 16)
      .attr("x",(2007-minYear) * yearWidth + 5)
      .attr( "font-size", "14px")
  }

  function hideFlag(){
    frame.selectAll( ".flag" ).remove();
  }
  frame.node().play = function(){
    clearInterval(animationInterval);
    frame.node().isPlaying = true;
    frame.node().played = true;
    animationInterval = setInterval( nextFrame, duration );
  }
  function nextFrame(){
    if ( frame.node().isPlaying ){
      clearInterval(animationInterval);
      animationInterval = setInterval( nextFrame, duration );
    }
    if ( currentYear < minYear ){
      currentYear++;
      frame.select( "#progress" )
        .attr( "width", 0 );
      return;
    }
    goToFrame( currentYear + 1 );
  }
  function goToFrame( f ){
    currentYear = f;
    if ( currentYear > maxYear ){
      currentYear = minYear-1;
      frame.node().pause();
      frame.node().isPlaying = false;
      return;
    }
    updateSymbols( currentYear, false );
    updateTimeline( false );
    if ( currentYear == 2007 ){
      frame.node().pause();
      setTimeout( showFlag, duration );
      setTimeout( frame.node().play, duration + 2500 );
    } else {
      hideFlag();
    }
  }
  frame.node().pause = function(){
    clearInterval(animationInterval);
    frame.node().isPlaying = false;
  }
  frame.node().reset = function(){
    frame.node().pause();
    frame.node().isPlaying = false;
    goToFrame(minYear);
  }
})();