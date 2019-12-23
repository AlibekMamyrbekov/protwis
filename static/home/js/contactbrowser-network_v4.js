function createNetworkPlot(raw_data,original_width, inputGraph, containerSelector, segment_view = true) {
// https://github.com/d3/d3-3.x-api-reference/blob/master/Force-Layout.md
 //https://archive.nytimes.com/www.nytimes.com/interactive/2013/02/20/movies/among-the-oscar-contenders-a-host-of-connections.html

    // Other ideas 3D: https://bl.ocks.org/vasturiano/f59675656258d3f490e9faa40828c0e7
    
    
    circle_size = 20;
    max_link_size = 15; 

    // https://bl.ocks.org/mbostock/4600693
    // https://stackoverflow.com/questions/13455510/curved-line-on-d3-force-directed-tree
    // http://bl.ocks.org/mbostock/1153292
    var curved_links = true;

    // var dr = 4,      // default point radius
    // off = 15,    // cluster hull offset
    // expand = {}, // expanded clusters
    // data, net, force, hullg, hull, linkg, link, nodeg, node;

    var w = original_width;
    var h = w;
    var height = w;
    var width;

    var selected_single_cluster = false

    var new_data;
    var plot_specified_filtered = filtered_gn_pairs;
    var cluster_groups = filtered_cluster_groups;
    var stickyDrag = true;
    var highlightNode = true;
    function prepare_data(single_cluster = false) {

        console.log('PREPARE DATA',containerSelector,'cluster_groups',cluster_groups.length, plot_specified_filtered.length )

        selected_single_cluster = single_cluster;

        new_data = { "nodes": [], "links": [] };
        var track_gns = [];
        // cluster_groups = [];
        // console.log('single_cluster',single_cluster);
        // // // Populate matrix for interactions between segments
        // track_gns = []
        // $.each(raw_data['interactions'], function (i, v) {
        //     if (!plot_specified_filtered.includes(i)) return;
        //     gns = separatePair(i);

        //     test1 = cluster_groups.filter(l => l.includes(gns[0]));
        //     test2 = cluster_groups.filter(l => l.includes(gns[1]));
        //     if (!test1.length && !test2.length) {
        //         cluster_groups.push([gns[0], gns[1]]);
        //     } else if (test1.length && !test2.length) {
        //         i1 = cluster_groups.indexOf(test1[0])
        //         cluster_groups[i1].push(gns[1]);
        //     } else if (!test1.length && test2.length) {
        //         i2 = cluster_groups.indexOf(test2[0])
        //         cluster_groups[i2].push(gns[0]);
        //     } else if (test1.length && test2.length) {
        //         i1 = cluster_groups.indexOf(test1[0])
        //         i2 = cluster_groups.indexOf(test2[0])
        //         //i1 = cluster_groups.indexOfForArrays(test1[0]);
        //         if (i1!=i2) {
        //             cluster_groups[i1] = test1[0].concat(test2[0])
        //             cluster_groups.splice(i2, 1);
        //         }
        //     }

        //     // if (seg1 != seg2) {
        //     //     new_data["links"].push({ "source": gns[0], "target": gns[1], "value": 1 })
        //     // }
        // });

        $.each(raw_data['interactions'], function (i, v) {
            if (!plot_specified_filtered.includes(i)) return;
            gns = separatePair(i);
            seg1 = raw_data['segment_map'][gns[0]];
            seg2 = raw_data['segment_map'][gns[1]];

            cg = cluster_groups.filter(l => l.includes(gns[0]));
            cg_index1 = cluster_groups.indexOf(cg[0]);
            cg = cluster_groups.filter(l => l.includes(gns[1]));
            cg_index2 = cluster_groups.indexOf(cg[0]);

            if (single_cluster!==false && (cg_index1!=single_cluster || cg_index2!=single_cluster)) return;

            if (!track_gns.includes(gns[0])) {
                new_data["nodes"].push({ "name": gns[0], "group": seg1, "group2":cg_index1, "links":0 })
                track_gns.push(gns[0]);
            }
            if (!track_gns.includes(gns[1])) {
                new_data["nodes"].push({ "name": gns[1], "group": seg2, "group2":cg_index2, "links":0 })
                track_gns.push(gns[1]);
            }

            source = new_data["nodes"].filter(obj => { return obj.name === gns[0] })[0];
            source.links += 1;
            target = new_data["nodes"].filter(obj => { return obj.name === gns[1] })[0];
            target.links += 1;
            new_data["links"].push({ "source": source, "target": target, "value": 1 })
        })


        console.log(cluster_groups);
            // console.log(graph);
        // new_data['nodes'].forEach(function (n) {
        //     cg = cluster_groups.filter(l => l.includes(n.name));
        //     cg_index = cluster_groups.indexOf(cg[0]);
        //     console.log(n, n.size, cg_index, cg);
        //     n.group2 = cg_index;
        // });
        // console.log(new_data['nodes']);

        if (!segment_view) {
            // resize by number of nodes if not segments
            console.log(new_data["nodes"].length, "nodes");
            width = original_width*Math.sqrt(new_data["nodes"].length/2);
        } else {
            width = original_width*1;
        }
        w = width;
        h = w;
        height = w;

    }
    prepare_data();




    var expand = {},net, force;

    d3v4.select(containerSelector).style("position","relative");

    div = d3v4.select(containerSelector).insert("div")
        .attr("class", "network")
        .style("width", "100%")
        .style("-webkit-backface-visibility", "hidden");

    init();
    
    var path, link, node, svg,labelText;
    function init() {
        console.log('init',div, containerSelector);
        div = d3v4.select(containerSelector).select("div");
        div.select("svg").remove();
        // if (force) force.stop();
        svg = div.append("svg:svg")
            .attr("viewBox", "0 0 " + w + " " + h)
            .attr("width", "100%")
            .attr("style", "height: 500px");
        
        // slightly hide the initial load
        svg.attr("opacity", 1e-6)
            .transition()
            .duration(3000)
            .attr("opacity", 1);

        var graph = new_data;

        if (segment_view) {
            // Group nodes into their "groups" (segments)
            graph = network(new_data, net, getGroup, expand);

            max_size = Math.max.apply(Math, graph['nodes'].map(function(v) {
                return v.size;
            }));

            max_link = Math.max.apply(Math, graph['links'].map(function(v) {
                return v.size;
            }));

            // normalize
            graph['links'].forEach(function (n) {
                n.links = n.size;
                n.size = Math.max(1,Math.round(max_link_size*n.size/max_link));
            });
        }
        
    
        // var link = svg.append("g")
        //     .attr("class", "links")
        //     .selectAll("line")
        //     .data(graph.links)
        //     .enter()
        //     .append("line")
        //     .attr("class", "link")
        //     .style("stroke-width", function(d) { return d.size || 5; })
        //     .attr("stroke", "black")
    
        var link = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(graph.links)
            .enter()
            .append("path")
            .attr("class", "link")
            .style("fill", "none")
            .style("stroke-width", function(d) { return d.size || 5; })
            .style("stroke", "#000")
            .attr("id", function (d, i) { return containerSelector+"linkId_" + i; });
        
            // .style("fill", "none")
            // // .style("stroke-width", "8")
            // .style("stroke-width", function(d) { return d.size || 5; })
            // .style("stroke", "#000");
        
        var labelText = svg.selectAll(".labelText")
            .data(graph.links)
          .enter().append("text")
            .attr("class","labelText")
            .attr("dx",0)
            .attr("dy",function(d,i) { return  d.size ? -d.size/2 : -5/2;})
            .style("fill", "black")
            .style("opacity", 0.5)
            .attr("id", function (d, i) { return "labelText_" + i; })
            .append("textPath")
            .attr("xlink:href", function (d, i) { return "#"+containerSelector+"linkId_" + i; })
            .attr("startOffset","50%").attr("text-anchor","Middle")
            .text(function(d,i) { return  d.links;});
        
        var n = graph.nodes.length;
        var node = svg.selectAll(".node")
            .data(graph.nodes)
            .enter()
            .append("g")
            .attr("transform", function(d, i) {
                var x = width / n * i;
                return "translate(" + x + "," + x + ")";
            })
            .call(d3v4.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))
            .on("dblclick", dblclick)
            .on('contextmenu', function(d){ 
                    d3v4.event.preventDefault();
                    if (selected_single_cluster) {
                        console.log('already zoomed in')
                        prepare_data(false);
                    } else { 
                        prepare_data(d.group2);
                    }
                    init();
            })
            .on("mouseover", (d) => {
                if (!dragged && highlightNode) {
                    highlight_network(d)
                }
            })
            .on("mouseout", (d) => {
                if (!dragged && highlightNode) {
                    link.style("stroke-opacity", 0.5)
                    node.style("opacity", 1)
                }
            });
        
        
        node.append("circle")
            .attr("class", "node")
            .attr("r", function (d) { return d.size ? assignSize(d.group) : 20; })
            // .attr("r", function (d) { return d.links**2+20; })
            .style("opacity", 1)
            .style("fill", function (d) { return assignRainbowColor(d.group); });
        
        node.append("text")
            .attr("dy", ".35em")
            .attr("text-anchor", 'middle')
            .attr("fill", "#000")
            .attr("cursor", "pointer")
            .attr("font-size", function (d) { return d.size ? assignSize(d.group) - 6 : 12; })
            .text(function (d) { return d.size ? d.group : d.name });
        
        
        
        
        var ticked = function() {
            node.attr("transform", function (d) {
                size = d.size ? assignSize(d.group) : 20
                size += 2;
                d.x = Math.max(size, Math.min(width - size, d.x));
                d.y = Math.max(size, Math.min(height - size, d.y));
                return "translate(" + d.x + "," + d.y + ")";
            });
            link
                .attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function (d) { return d.target.y; });
            
            link.attr("d", function(d, i) {
                var dx = d.target.x - d.source.x,
                    dy = d.target.y - d.source.y,
                    dr = Math.sqrt(dx * dx + dy * dy);
                // return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;

                if (dx > 0) {
                    return "M" + d.source.x + " " + d.source.y + " L " + d.target.x + " " + d.target.y;
                } else {
                    return "M" + d.target.x + " " + d.target.y + " L " + d.source.x + " " + d.source.y;
                }
            });
        }  
        // tooltip https://observablehq.com/@skofgar/force-directed-graph-integrated-html

        var simulation = d3v4.forceSimulation()
            // .force("collide",d3v4.forceCollide( function(d){return 30 }).iterations(1) )
            // .force("collide",d3v4.forceCollide( function (d) { return d.links**2+10; }).strength(0.5).iterations(5))
            // .alphaDecay(0)
            .force("charge", d3v4.forceManyBody().strength(-700))
            .force("x", d3v4.forceX(w/2).strength(0.0))
            .force("y", d3v4.forceY(h/2).strength(0.0));
        
        link_distance = 70;
        link_strength = 0.7;
        gravity = 0;
        charge = -700;
        var distanceMax = 0;
        collide = 0;
        var useGroupingForce = false;
        // simulation.alphaDecay(0.001);
        if (selected_single_cluster === false && cluster_groups.length > 1 && !segment_view) {

            max_cluster_size = Math.max.apply(Math, cluster_groups.map(function(v) {
                return v.length;
            }));
            
            distanceMax = max_cluster_size*20;
            simulation.force("charge", d3v4.forceManyBody()
                .strength(charge)
                .distanceMax(distanceMax)
            )
            gravity = 0.1;
            useGroupingForce = true;
            // Instantiate the forceInABox force
            var groupingForce = forceInABox()
                .strength(gravity) // Strength to foci
                .template("treemap") // Either treemap or force
                .groupBy("group2") // Node attribute to group
                // .links(graph.links) // The graph links. Must be called after setting the grouping attribute
                .size([width, height]) // Size of the chart
            simulation
                .force("group", groupingForce)
            simulation.force("collide", d3v4.forceCollide(function (d) { return d.links ** 2 + 20; }).strength(1).iterations(1))
        } else {
            if (segment_view) {
                console.log('segment! collide');
                collide = 50;
                simulation.force("collide", d3v4.forceCollide(function (d) { return 50; }).strength(1).iterations(1))
                link_distance = 90;
                link_strength = 0.7;
                // link_strength = function (l) { return l.size / max_link_size };
                gravity = 0.04;
                simulation
                .force("x", d3v4.forceX(w/2).strength(gravity))
                .force("y", d3v4.forceY(h/2).strength(gravity));

                // simulation.force("charge", d3v4.forceManyBody().strength(function (d) { return -d.size*50 }))
            } else {
                // charge = -1200;
                gravity = 0.05;
                simulation.force("charge", d3v4.forceManyBody().strength(charge))
                    .force("x", d3v4.forceX(w/2).strength(gravity))
                    .force("y", d3v4.forceY(h / 2).strength(gravity));
                
                // simulation.force("charge", d3v4.forceManyBody().strength(function (d) { return -(d.links**3) }))
                simulation.force("collide", d3v4.forceCollide(function (d) { return d.links ** 2 + 20; }).strength(1).iterations(1))
            }
        }
        // console.log('distance_max', distance_max, cluster_groups.length, selected_single_cluster);
        
      
        // simulation.force("collide", d3v4.forceCollide(function (d) { return 0; }).strength(1).iterations(1))
        

        
        // simulation
        //     .nodes(graph.nodes)
        //     .on("tick", ticked);
    
        // simulation.force("link")
        //     .links(graph.links);  

        simulation
            .nodes(graph.nodes)
            .force("link", d3v4.forceLink(graph.links)
                .distance(link_distance)
                .strength(link_strength).iterations(1)
                // .strength(0.8).iterations(1)
            //   .strength(groupingForce.getLinkStrength) // default link force will try to join nodes in the same group stronger than if they are in different groups
            ).on("tick", ticked);
        
          
        // https://bl.ocks.org/mbostock/3750558
        function dblclick(d) {
            if (!d3v4.event.active) simulation.alphaTarget(0);
            // d3v4.select(this).classed("fixed", d.fixed = false);
            d3v4.select(this).select("circle").classed("fixed", false);
            d.fx = null;
            d.fy = null;
        }

        function highlight_network(d) {
            ds = [d.name];
            already_done = [];
            link.transition();
            node.transition();
            link.style("stroke-opacity", 0.05)
            node.style("opacity", 0.05);
            delay_step = 0;
            steps = 4;
            for (let step = 0; step < steps; step++) {
                ds2 = []
                link.filter(l => !already_done.includes(l) && ( ds.includes(l.source.name) || ds.includes(l.target.name))).style('stroke-opacity', function (l) {
                        ds2.push(l.source.name, l.target.name);
                        already_done.push(l)
                        return 1-0.8*(step/steps)
                })
                ds = ds2;
                node.filter(d => !already_done.includes(d) && ds.includes(d.name)).style('opacity', function (d) {
                    already_done.push(d)    
                    return 1 - 0.8*(step/steps);
                })
                // console.log(step, ds);
            }
        }
        
        dragged = false;
        function dragstarted(d) {
            dragged = true;
            d3v4.select(this).select("circle").classed("fixed", true);
            if (!d3v4.event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        function dragged(d) {
            dragged = true;
            d.fx = d3v4.event.x;
            d.fy = d3v4.event.y;
        }
        
        function dragended(d) {
            dragged = false;
            if (!d3v4.event.active) simulation.alphaTarget(0);
            if (!stickyDrag) {
                d.fx = null;
                d.fy = null;
                d3v4.select(this).select("circle").classed("fixed", false);
            }
        } 

        create_overlay();

        d3v4.select(containerSelector).select("#link_strength_change")
            .on("input", link_strength_change);
        
        function link_strength_change() {
            console.log('link strength', this.value);
            simulation.force("link").strength(+this.value);
            if (!d3v4.event.active) simulation.alpha(1).restart();
        }
        
        d3v4.select(containerSelector).select("#link_distance_change")
            .on("input", link_distance_change);
        
        function link_distance_change() {
            console.log('link distance', this.value);
            simulation.force("link").distance(+this.value);
            if (!d3v4.event.active) simulation.alpha(1).restart();
        }
        
        d3v4.select(containerSelector).select("#gravity_change")
            .on("input", gravity_change);
        
        function gravity_change() {
            gravity = this.value;
            console.log('gravity', gravity);
            if (useGroupingForce) {
                var groupingForce = forceInABox()
                    .strength(+this.value) // Strength to foci
                    .template("treemap") // Either treemap or force
                    .groupBy("group2") // Node attribute to group
                    // .links(graph.links) // The graph links. Must be called after setting the grouping attribute
                    .size([width, height]) // Size of the chart
            
                simulation.force("group", groupingForce);
            } else {
                simulation.force("x", d3v4.forceX(w/2).strength(gravity))
                .force("y", d3v4.forceY(h/2).strength(gravity));    
            }
            if (!d3v4.event.active) simulation.alpha(1).restart();
        }
        
        d3v4.select(containerSelector).select("#charge_change")
            .on("input", charge_change);
        
        function charge_change() {
            console.log('charge', this.value);
            if (distanceMax) {
                simulation.force("charge", d3v4.forceManyBody()
                    .strength(+(-1 * this.value))
                    .distanceMax(distanceMax)
                    )
            } else {
                simulation.force("charge", d3v4.forceManyBody()
                        .strength(+(-1*this.value))
                    )
            }
            if (!d3v4.event.active) simulation.alpha(1).restart();
        }

        d3v4.select(containerSelector).select("#collide_change")
            .on("input", collide_change);
        
        function collide_change() {
            console.log('collide', this.value);
            simulation.force("collide", d3v4.forceCollide(this.value).strength(1).iterations(1))
            if (!d3v4.event.active) simulation.alpha(1).restart();
        }

        d3v4.select(containerSelector).select("#size_change")
            .on("input", size_change);
        
        function size_change() {
            width = height = w = h = this.value;
            svg.attr("viewBox", "0 0 " + w + " " + h);
            // simulation.force("center", d3v4.forceCenter(w / 2, h / 2));
            if (useGroupingForce) {
                var groupingForce = forceInABox()
                .strength(gravity) // Strength to foci
                .template("treemap") // Either treemap or force
                .groupBy("group2") // Node attribute to group
                // .links(graph.links) // The graph links. Must be called after setting the grouping attribute
                .size([width, height]) // Size of the chart
            
                simulation.force("group", groupingForce);
            }

            simulation.force("x", d3v4.forceX(w/2))
                      .force("y", d3v4.forceY(h/2));
            simulation.alpha(1).restart();
        }
        
        d3.select(containerSelector).select("#stickyDrag").on("change", function () {
            stickyDrag = d3.select(containerSelector).select("#stickyDrag").property("checked");
        });
        d3.select(containerSelector).select("#highlightNode").on("change", function () {
            highlightNode = d3.select(containerSelector).select("#highlightNode").property("checked");
        });

        d3.select(containerSelector).select("#linkLabel").on("change", function () {
            linkLabel = d3.select(containerSelector).select("#linkLabel").property("checked");
            labelText.attr("visibility", linkLabel ? "visible" : "hidden");
            
        });

        // init option values

        // console.log("set link_strength_change to", link_strength);
        // d3v4.select(containerSelector).select("#link_strength_change").property("value", link_strength);
        console.log("set link_distance_change to", link_distance);
        d3v4.select(containerSelector).select("#link_distance_change").property("value", link_distance);
        console.log("set charge_change to", charge);
        d3v4.select(containerSelector).select("#charge_change").property("value", -charge);
        console.log("set gravity to", gravity);
        d3v4.select(containerSelector).select("#gravity_change").property("value", gravity);
        console.log("set collide to", collide);
        d3v4.select(containerSelector).select("#collide_change").property("value", gravity);

        
              

    }
    // https://bl.ocks.org/mbostock/3750558
    function dblclick(d) {
    d3.select(this).classed("fixed", d.fixed = false);
    }

    function dragstart(d) {
    d3.select(this).classed("fixed", d.fixed = true);
    }

    function bindTreeMap() {
        // d3.selectAll(".cell").each(function (d, i) {
        //     console.log("i", i, "d", d);
        //     d.on("click", function(d){ console.log('clicked1')}) 
        // })
        div.selectAll(".cell").attr("fill", "#fff").on("click", function(d){ 
            if (selected_single_cluster!==false) {
                console.log('already zoomed in')
                prepare_data(false);
            } else {
                console.log('clicked tree, redraw only',d.id) 
                prepare_data(d.id);
            }
            init();
            })
        // d3.selectAll(".node").attr("fill", "#111").on("click", function (d) { console.log('clicked1 node') })
        
        $(containerSelector).find(".cell").appendTo(containerSelector+" .treemap");
        console.log('bind tree map!',containerSelector);
        // console.log($(".cell"));
        // $(".cell").click(function () {
        //     console.log('clicked!');
        // })
    }

    function network(data, prev, index, expand) {
        expand = expand || {};
        var gm = {},    // group map
            nm = {},    // node map
            lm = {},    // link map
            gn = {},    // previous group nodes
            gc = {},    // previous group centroids
            nodes = [], // output nodes
            links = []; // output links
    
        // process previous nodes for reuse or centroid calculation
        if (prev) {
            prev.nodes.forEach(function(n) {
            var i = index(n), o;
            if (n.size > 0) {
                gn[i] = n;
                n.size = 0;
            } else {
                o = gc[i] || (gc[i] = {x:0,y:0,count:0});
                o.x += n.x;
                o.y += n.y;
                o.count += 1;
            }
            });
        }
    
        // determine nodes
        for (var k=0; k<data.nodes.length; ++k) {
            var n = data.nodes[k],
                i = index(n),
                l = gm[i] || (gm[i]=gn[i]) || (gm[i]={group:i, size:0, nodes:[]});
    
            if (expand[i]) {
            // the node should be directly visible
            nm[n.name] = nodes.length;
            nodes.push(n);
            if (gn[i]) {
                // place new nodes at cluster location (plus jitter)
                n.x = gn[i].x + Math.random();
                n.y = gn[i].y + Math.random();
            }
            } else {
            // the node is part of a collapsed cluster
            if (l.size == 0) {
                // if new cluster, add to set and position at centroid of leaf nodes
                nm[i] = nodes.length;
                nodes.push(l);
                if (gc[i]) {
                l.x = gc[i].x / gc[i].count;
                l.y = gc[i].y / gc[i].count;
                }
            }
            l.nodes.push(n);
            }
        // always count group size as we also use it to tweak the force graph strengths/distances
            l.size += 1;
        n.group_data = l;
        }
    
        for (i in gm) { gm[i].link_count = 0; }
    
        // determine links
        for (k=0; k<data.links.length; ++k) {
            var e = data.links[k],
                u = index(e.source),
                v = index(e.target);
        if (u != v) {
            gm[u].link_count++;
            gm[v].link_count++;
        }
            u = expand[u] ? nm[e.source.name] : nm[u];
            v = expand[v] ? nm[e.target.name] : nm[v];
            var i = (u<v ? u+"|"+v : v+"|"+u),
                l = lm[i] || (lm[i] = {source:u, target:v, size:0});
            l.size += 1;
        }
        for (i in lm) { links.push(lm[i]); }
    
        return {nodes: nodes, links: links};
    }
        
    function getGroup(n) { return n.group; }



    function assignSize(segment) {

        switch (segment) {
        case "TM1":
            size = 20;
            break;
        case "TM2":
            size = 20;
            break;
        case "TM3":
            size = 20;
            break;
        case "TM4":
            size = 20;
            break;
        case "TM5":
            size = 20;
            break;
        case "TM6":
            size = 20;
            break;
        case "TM7":
            size = 20;
            break;
        case "H8":
            size = 18;
            break;
        default:
            size = 15;
        }
        return size;
    }
    
    function assignRainbowColor(segment) {
        var segmentRainbowColors2 = {
            "1": "#736DA7",
            "2": "#5EB7B7",
            "3": "#CE9AC6",
            "4": "#DD7D7E",
            "5": "#E6AF7C",
            "6": "#DEDB75",
            "7": "#80B96F",
            "8": "#EEE",
            "0": "#EEE"
        };
        var color = "";
        switch (segment) {
        case "TM1":
            color = segmentRainbowColors2["1"];
            break;
        case "TM2":
            color = segmentRainbowColors2["2"];
            break;
        case "TM3":
            color = segmentRainbowColors2["3"];
            break;
        case "TM4":
            color = segmentRainbowColors2["4"];
            break;
        case "TM5":
            color = segmentRainbowColors2["5"];
            break;
        case "TM6":
            color = segmentRainbowColors2["6"];
            break;
        case "TM7":
            color = segmentRainbowColors2["7"];
            break;
        case "H8":
            color = segmentRainbowColors2["8"];
            break;
        default:
            color = segmentRainbowColors2["0"];
        }
        return color;
    }

    function create_overlay() {
        var newDiv = document.createElement("div");

        $(containerSelector).find(".controls-panel").remove();

        newDiv.setAttribute("class", "controls-panel");

        var content = '<div class="controls">'
        //                                  +'<h4>Controls</h4>';


        content += '<p>Line colors: <select id="flareplot_color">' +
            '<option value="none">None (gray)</option>' +
            '<option value="rainbow">GPCR rainbow</option>' +
            '<option value="segment">GPCR segment</option>';

        var mode = get_current_mode();
        // if single structure - use interaction coloring
        if (mode == "single-crystal") {
            content += '<option value="interactions" selected>Interaction Type</option>';
            // if single group of structures - use frequency coloring (gradient)
        } else if (mode == "single-crystal-group") {
            content += '<option value="frequency" selected>Interaction Frequency/Count</option>';
            // if group(s) of structures - use frequency coloring (gradient)
        } else {
            content += '<option value="frequency" selected>Frequency difference Gr1 - Gr2</option>';
            content += '<option value="frequency_1">Frequency group 1</option>';
            content += '<option value="frequency_2">Frequency group 2</option>';
        }
        content += '</select></p>';
        content = '<span class="pull-right network_controls_toggle" style="cursor: pointer;"><span class="glyphicon glyphicon-option-horizontal btn-download png"></span></span><span class="options" style="display: block; min-width: 120px;">' +
        // '<input id="checkCurved" type="checkbox" checked>' +
        // '<span class="checkboxtext"> Curved links' +
        // '</span>' +
        // '</input>' +
        // '<br><button class="btn btn-primary btn-xs" id="resetfixed">Release fixed</button>' +
        // '<br><button class="btn btn-primary btn-xs" id="freeze">Freeze all</button>' +
        'Link Label <input id="linkLabel" type="checkbox" checked><br>' +
        'Stick drag <input id="stickyDrag" type="checkbox" checked><br>' +
        'Highlight res <input id="highlightNode" type="checkbox" checked><br>' +
        'Link Strength <input id="link_strength_change" style="width:80px;" type="range" min="0" max="1" step="any" value="0.5">' +
        'Link Distance<input id="link_distance_change" style="width:80px;" type="range" min="0" max="200" step="any" value="40">' +
        'Charge<input id="charge_change" style="width:80px;" type="range" min="0" max="1400" step="any" value="700">' +
        'Gravity<input id="gravity_change" style="width:80px;" type="range" min="0" max="1" step="any" value="0.1"> ' +
        'Collide<input id="collide_change" style="width:80px;" type="range" min="0" max="200" step="any" value="30"> ' +
        'Space<input id="size_change" style="width:80px;" type="range" min="200" max="4000" step="any" value="'+w+'"> ' +
        '</span>';
        // content = '';
        newDiv.innerHTML = content;

        $(containerSelector).append(newDiv);
        $(containerSelector).find(".options").toggle();

        $(containerSelector).find(".network_controls_toggle").click(function() {
            $(containerSelector).find(".options").toggle();
        });

        d3.select(containerSelector).select("#checkCurved").on("change", function () {
            curved_links = d3.select(containerSelector).select("#checkCurved").property("checked");
            console.log('they changed!', curved_links, containerSelector)
            if (curved_links) {
                link.style("visibility", "hidden");
                path.style("visibility", "");

            } else {
                path.style("visibility", "hidden");
                link.style("visibility", "");
            }

            // init();
        });
                
        d3.select(containerSelector).select("#resetfixed").on("click", function () {
            node.classed("fixed", function (d) {
                d.fixed = false;
            });
            force.start();
        });

        d3.select(containerSelector).select("#freeze").on("click", function () {
            node.classed('fixed', function(d, i) {
                d.fixed = true;
            });
        });

        
        
    }
    
}

Array.prototype.indexOfForArrays = function(search)
{
  var searchJson = JSON.stringify(search); // "[3,566,23,79]"
  var arrJson = this.map(JSON.stringify); // ["[2,6,89,45]", "[3,566,23,79]", "[434,677,9,23]"]
    console.log("hi!",arrJson, searchJson,arrJson.indexOf(searchJson));
  return arrJson.indexOf(searchJson);
};