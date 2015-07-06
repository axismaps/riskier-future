(function(){
  var width = 1000,
    height = 560;

  var frame = d3.select(".iframe")
    .insert("div",".play")
    .attr("class","frame")
    .attr("id","percent-urban")
    .attr("name","percent_urban")
    .style("display","none")
      
  var svg = frame
    .append( "svg" )
    .attr( "class", "YlGnBu" )
    .attr( "width", width )
    .attr( "height", height );

  var boundary = svg.append("g")
      .attr( "id", "boundary" );

  var countries = svg.append( "g" )
    .attr( "id", "countries" );

  var mask = svg.append( "rect" )
    .attr({
      x: 0,
      y: height-105,
      width: width,
      height: 105
    })
    .attr( "fill", "rgba(0,0,0,.5)" );

  frame.select( "header" ).style( "width", width + "px" );

  var projection = d3.geo.times()
    .center([0,5])
    .rotate( [-25,0])
      .scale(250)
      .translate([width / 2, height / 2])
      .precision(.1);

  var path = d3.geo.path()
    .projection( projection );

  var classification = d3.scale.linear()
      .domain([20, 30, 40, 50, 60, 70, 80, 90])
      .range([
      "#fff5f0",
      "#fee0d2",
      "#fcbba1",
      "#fc9272",
      "#fb6a4a",
      "#ef3b2c",
      "#cb181d",
      "#a50f15"
    ]);

  var duration = 150;

  var jsonData,
    csvData;

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

  queue()
    .defer( d3.json, "data/json/admin0_ms1.json" )
    .defer( d3.json, "data/json/disputed.geojson" )
    .defer( d3.csv, "data/csv/percent_urban.csv" )
    .defer( d3.csv, "data/csv/urban_total.csv" )
    .defer( d3.csv, "data/csv/rural_total.csv" )
    .await( function( err, json, disp, csv, urban, rural ){
      jsonData = json;
      jsonData.features = jsonData.features.concat( disp.features );
      csvData = _.indexBy( csv, "Country Code" );
      urbanTotal = _.indexBy( urban, "Country Code" );
      ruralTotal = _.indexBy( rural, "Country Code" );
      createMap();

      frame.on( "click", function(){
        if ( !frame.node().isPlaying ) frame.node().play();
        else frame.node().pause();
      })
    });

  function createMap(){
    _.each( csvData, function(row){
      _.each( jsonData.features, function(f){
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
      .attr( "id", function(d){ return d.properties.ISO_A2 })
      .attr( "d", path )
      .on( "mouseover", function(d){
        frame.selectAll(".highlight").classed("highlight",false);
        d3.select(this).classed("highlight",true);
        d3.select(this).node().parentNode.appendChild(this);
        probe.datum(d)
          .html(
            "<p>" + d.properties.WB_ADM0_NA + "</p>" +
            "<p>" + Math.round( parseFloat(d.properties.data[currentYear >= minYear ? currentYear : maxYear]) ) + "% urban</p>"
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
        frame.selectAll(".highlight").classed("highlight",false);
        probe.style("display","none");
      })

    var probe = frame.append( "div" ).attr( "id","probe" );

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
    

    goToFrame( minYear );
    //frame.node().play();

  }


  function updateChoropleth( fieldName, tween ){
    if ( tween ){
      countries.selectAll( "path" )
        .transition()
        .ease( "linear" )
        .duration( tween ? duration : 10 )
        .attr( "fill", function(d){ 
          if ( !d.properties.data ) return "#eee"
          return classification( d.properties.data[fieldName] ) 
        });
      } else {
        countries.selectAll( "path" )
          .attr( "fill", function(d){ 
            if ( !d.properties.data ) return "#eee"
            return classification( d.properties.data[fieldName] ) 
          });
      }
    
    if ( tween ) setTimeout( function(){ frame.select( "#year" ).text( fieldName ) }, duration );
    else frame.select( "#year" ).text( fieldName )
    
    frame.select("#probe")
      .html(function(d){
        if ( !d ) return "";
        return "<p>" + d.properties.WB_ADM0_NA + "</p><p>" + Math.round( parseFloat(d.properties.data[currentYear]) ) + "% urban</p>"
      })
  }

  function createLegend(){
    var legend = frame.select( "header" )
      .append( "svg"  )
      .attr( "width", 75)
      .attr( "height", 75)
      .append( "g" );
    var gradient = legend.append( "defs" )
      .append( "linearGradient" )
      .attr({
        id: "grad",
        x1: "0%",
        y1: "0%",
        x2: "100%",
        y2: "0%"
      });
    var len = classification.range().length - 1;
    classification.range().forEach( function(r,i){
      gradient.append( "stop" )
        .attr( "offset", i * 100/len + "%")
        .style( "stop-color", r )
        .style( "stop-opacity", 1 );
    });

    legend.append( "rect" )
      .attr({
        width: 70,
        height: 30,
        x: 5,
        y: 0,
        fill: "url(#grad)",
        stroke: "#999"
      });
    legend.append( "text" )
      .text( "0 – 100%" )
      .attr( "fill", "#333" )
      .attr( "text-anchor", "middle")
      .attr( "x", 35 )
      .attr( "y", 50 );
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
    var urban = csvData[ id ];
    
    var chartScale = d3.scale.linear()
      .domain( [0,100] )
      .range( [75,0] );
    var yearWidth = (width-230)/(maxYear-minYear);
    var d = "";
    frame.selectAll( "#chart path" ).remove();
    frame.selectAll( "#chart rect" ).remove();
    frame.select( "#chart g" ).remove();
    frame.select( "#chart-title" ).remove();
    for ( year=minYear; year<=maxYear; year++ ){
      //console.log(chartScale( urban[year]))
      var command;
      if ( year == minYear ){
        command = "M";
      } else {
          command = "L";
      }
      d += command + Math.round( (year-minYear)*yearWidth ) + " " + chartScale( urban[year] );
    }
    d += "V" + chartScale.range()[0] + "H0Z";

    frame.select( "#chart" )
      .append( "rect" )
      .attr( "class", "rural" )
      .attr({
        x: 0,
        y: 0,
        width: width-230,
        height: chartScale.range()[0]
      });

    frame.select( "#chart" )
      .append( "path" )
      .attr( "class", "urban" )
      .attr( "d", d )
    

    var axis = d3.svg.axis()
      .scale( chartScale )
      .orient( "right" )
      .ticks(3)
      .innerTickSize( (width-230) )
      .outerTickSize( (width-230) )
      .tickFormat( function(d){
        if ( d==0 ) return "";
        return d + "%"
      });

    frame.select( "#chart" )
      .append( "g" )
      .attr( "id", "axis" )
      .call( axis );

    frame.selectAll( ".tick text" ).attr( "dy", 10 );

    frame.select( "#chart" )
      .append( "line" )
      .attr({
        x1: 0,
        y1: 15,
        x2: 15,
        y2: 0,
        transform: "translate( -25,-25 )",
        class: "urban"
      });

    frame.select( "#chart" )
      .append( "text" )
      .attr( "id", "chart-title" )
      .attr( "x", -175 )
      .attr( "y", -10 )
      .text( urban["Country Name"] + " Urban Population" );   
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
    animationInterval = setInterval( nextFrame, duration );
    frame.node().isPlaying = true;
    played = true;
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
      frame.node().isPlaying = false;
      frame.node().pause();
      return;
    }
    updateChoropleth( f, false );
    updateTimeline( false );
    if ( f == 2007 ){
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