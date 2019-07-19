var stage = {}; // store ngl stages
var pdb_data = {}; // store returned pdb data
var reps = {} // store structure components
var gpcr_rep = {} // store molecule representations
var int_labels = []
var color_schemes = {};
var blue_colors = ['#f0fcfa', '#D3E4EA', '#B6CDDB', '#99B5CC', '#7C9EBD', '#5F86AE', '#426F9F', '#255790', '#084081']
var red_colors = ['#fbf0fc', '#f3dbec', '#ebc5df', '#dda8bc', '#cc7b7f', '#d3574e', '#be372b', '#ac1808', '#811808']
var rb_colors = ['#736DA7', '#5EB7B7', '#CE9AC6', '#DD7D7E', '#E6AF7C', '#DEDB75', '#80B96F', '#000000'] // #C897B8

// Reference values for table values
// entry: display (boolean), min, max, coloring
// Values for single residue (skipping the pairs)
dataType = {}
dataType["no_viewing"]     = [false, 0, 0, ""]
dataType["core_distance"]  = [true, 0, 15, "wb"]
dataType["rotation"]       = [true, 0, 180, "wb"]
dataType["rotamer"]        = [true, 0, 180, "wb"]
dataType["consensus_freq"] = [true, 0, 100, "wb"]
dataType["consensus_SS"]   = [true, 0, 100, "ss_coloring"]
dataType["SASA"]           = [true, 0, 200, "wb"]
dataType["RSA"]            = [true, 0, 100, "wb"]
dataType["HSE"]            = [true, 0, 20, "wb"]
dataType["conservation"]   = [true, 0, 100, "wb"]
dataType["phi"]            = [true, 0, 180, "wb"]
dataType["psi"]            = [true, 0, 180, "wb"]
dataType["tau"]            = [true, 0, 180, "wb"]
dataType["theta"]          = [true, 0, 180, "wb"]

// Same for differences between groups
// TODO: finetune to relative variation per data type
dataType["core_distance_diff"] = [true, -5, 5, "rwb"]
dataType["rotation_diff"]      = [true, -45, 45, "rwb"]
dataType["rotamer_diff"]       = [true, -45, 45, "rwb"]
dataType["ss_freq_diff"]       = [true, -50, 50, "rwb"]
dataType["SASA_diff"]          = [true, -50, 50, "rwb"]
dataType["RSA_diff"]           = [true, -25, 25, "rwb"]
dataType["HSE_diff"]           = [true, -10, 10, "rwb"]
//dataType["conservation"]  = [true, 0, 100, "rwb"]
dataType["phi_diff"]           = [true, -45, 45, "rwb"]
dataType["psi_diff"]           = [true, -45, 45, "rwb"]
dataType["tau_diff"]           = [true, -45, 45, "rwb"]
dataType["theta_diff"]         = [true, -45, 45, "rwb"]

// Secondary structure coloringData
var SS_COLORING = {
  "H": "#FF0000", // alpha helix
  "G": "#FF00FF", // 3-10 helix
  "I": "#00FF00", // pi helix
  "B": "#ffd700", // isolated bridge
  "E": "#00a8ff", // strand/extended conformation
  "T": "#ff5700", // turn
  "S": "#00ffff", // bend (unique to DSSP)
  "C": "#5d8aa8", // coil/other (STRIDE)
  "-": "#5d8aa8", // coil/other (DSSP)
}

function createNGLview(mode, pdb, pdbs = false, pdbs_set2 = false, pdb2 = false) {
    // console.log(mode, pdb, pdbs, pdbs_set2, pdb2);
    $("#ngl-" + mode).html("");
    stage[mode] = new NGL.Stage("ngl-" + mode, {
        backgroundColor: "white"
    });
    color_schemes[mode] = [
        [],
        []
    ];
    reps[mode] = [{}, {}]
    gpcr_rep[mode] = [];
    pdb_data[mode] = [];
    int_labels[mode] = []

    var first_structure;
    var num_set1;
    var gn_num_set1;
    var two_structures = false;

    $.getJSON("pdb/" + pdb,
        function(data) {
            var highlight = ['TM1', 'TM2', 'TM3', 'TM4', 'TM5', 'TM6', 'TM7', 'H8'];
            var segments_sets = {}
            int_labels[mode][0] = {}

            highlight.forEach(function(e) {
                segments_sets[e] = ((e in data['segments']) ? data['segments'][e].join(", ") : "")
            });

            pdb_data[mode][0] = data;
            color_schemes[mode][0]['blue'] = NGL.ColormakerRegistry.addSelectionScheme([
                [blue_colors[1], segments_sets[highlight[0]]],
                [blue_colors[2], segments_sets[highlight[1]]],
                [blue_colors[3], segments_sets[highlight[2]]],
                [blue_colors[4], segments_sets[highlight[3]]],
                [blue_colors[5], segments_sets[highlight[4]]],
                [blue_colors[6], segments_sets[highlight[5]]],
                [blue_colors[7], segments_sets[highlight[6]]],
                [blue_colors[8], segments_sets[highlight[7]]],
                ["white", "*"]
            ])

            color_schemes[mode][0]['grey'] = NGL.ColormakerRegistry.addSelectionScheme([
                ["#ccc", segments_sets[highlight[0]]],
                ["#bbb", segments_sets[highlight[1]]],
                ["#aaa", segments_sets[highlight[2]]],
                ["#888", segments_sets[highlight[3]]],
                ["#666", segments_sets[highlight[4]]],
                ["#444", segments_sets[highlight[5]]],
                ["#333", segments_sets[highlight[6]]],
                ["#111", segments_sets[highlight[7]]],
                ["white", "*"]
            ])

            color_schemes[mode][0]['rainbow'] = NGL.ColormakerRegistry.addSelectionScheme([
                [rb_colors[0], segments_sets[highlight[0]]],
                [rb_colors[1], segments_sets[highlight[1]]],
                [rb_colors[2], segments_sets[highlight[2]]],
                [rb_colors[3], segments_sets[highlight[3]]],
                [rb_colors[4], segments_sets[highlight[4]]],
                [rb_colors[5], segments_sets[highlight[5]]],
                [rb_colors[6], segments_sets[highlight[6]]],
                [rb_colors[7], segments_sets[highlight[7]]],
                ["white", "*"]
            ])

            chain_set1 = pdb_data[mode][0]['chain'];
            num_set1 = pdb_data[mode][0]['only_gn'];
            gn_num_set1 = pdb_data[mode][0]['gn_map'];

            var stringBlob = new Blob([pdb_data[mode][0]['pdb']], {
                type: 'text/plain'
            });
            stage[mode].loadFile(stringBlob, {
                ext: "pdb"
            }).then(function(o) {
                first_structure = o

                // Cleanup
                pdb_data[mode][0]['pdb'] = null;

                // TODO: cartoon for ECL2 is currently not shown (only 3 res, but 4 needed for cartoon) - show ribbon for ICL/ECLs?
                gpcr_rep[mode][0] = o.addRepresentation("cartoon", {
                    sele: ":" + pdb_data[mode][0]['chain'] + " and (" + pdb_data[mode][0]['only_gn'].join(", ") + ")",
                    radiusSize: 1,
                    radiusScale: 0.6,
                    color: color_schemes[mode][0]['blue'],
                    metalness: 0,
                    colorMode: "hcl",
                    roughness: 1,
                    opacity: 0.4,
                    side: "front",
                    depthWrite: true
                });

                // REMOVE default hoverPick mouse action
                stage[mode].mouseControls.remove("hoverPick")

                // Add residue labels for GN residues
                pdb_data[mode][0]['only_gn'].forEach(function(resNo, index) {
                    var genNo = pdb_data[mode][0]['gn_map'][index]
                    int_labels[mode][0][o.structure.id + "|" + resNo] = genNo
                })

                // listen to `hovered` signal to move tooltip around and change its text
                stage[mode].signals.hovered.add(function(pickingProxy) {
                    var label_index = false
                    var hide = true

                    if (pickingProxy && (pickingProxy.distance || pickingProxy.atom)) {
                        var mp = pickingProxy.mouse.position

                        if (pickingProxy.distance) {
                            label_index = pickingProxy.distance.atom1.structure.id + "|" + pickingProxy.distance.atom1.resno + "-" + pickingProxy.distance.atom2.resno;
                            ngl_tooltip.innerText = "INTERACTION:"
                        } else {
                            label_index = pickingProxy.atom.structure.id + "|" + pickingProxy.atom.resno;
                            ngl_tooltip.innerText = "RESIDUE:"
                        }

                        if (label_index) {
                            if (label_index in int_labels[mode][0]) {
                                ngl_tooltip.innerText += " " + int_labels[mode][0][label_index]
                                hide = false
                            } else if (mode == "two-groups" && (label_index in int_labels[mode][1])) {
                                ngl_tooltip.innerText += " " + int_labels[mode][1][label_index]
                                hide = false
                            }
                            ngl_tooltip.style.bottom = window.innerHeight - mp.y + 3 + "px"
                            ngl_tooltip.style.left = mp.x + 3 + "px"
                            ngl_tooltip.style.display = "block"
                        }
                    }
                    if (hide) {
                        ngl_tooltip.style.display = "none"
                    }
                })

                reps[mode][0].structureComponent = o
                createNGLRepresentations(mode, 0, false)

                // Automatic GPCR positioning
                if ("translation" in pdb_data[mode][0]) {
                    var translation = JSON.parse(pdb_data[mode][0]["translation"])
                    var center_axis = JSON.parse(pdb_data[mode][0]["center_axis"])

                    // calculate rotation and apply
                    v1 = new NGL.Vector3(0, 1, 0)
                    v2 = new NGL.Vector3(center_axis[0], center_axis[1], center_axis[2])
                    var quaternion = new NGL.Quaternion(); // create one and reuse it
                    quaternion.setFromUnitVectors(v2, v1)
                    o.setRotation(quaternion)

                    // calculate translation and apply
                    var v = new NGL.Vector3(-1 * translation[0], -1 * translation[1], -1 * translation[2])
                    v.applyMatrix4(o.matrix)
                    o.setPosition([-1 * v.x, -1 * v.y, -1 * v.z])

                    // calculate H8 position (based on TM1)
                    var tm1_vector
                    var ref_tm1 = pdb_data[mode][0]["only_gn"][pdb_data[mode][0]["gn_map"].indexOf("1x46")]
                    o.structure.eachAtom(function(ap) {
                        tm1_vector = new NGL.Vector3(ap.x, ap.y, ap.z)
                        tm1_vector.applyMatrix4(o.matrix)
                    }, new NGL.Selection(":" + pdb_data[mode][0]['chain'] + " and " + ref_tm1 + " and .CA"))

                    tm1_vector.y = 0 // height position doesn't matter
                    tm1_vector.normalize()

                    // calculate rotation angle around Y-axis (as the GPCR is now upright)
                    v3 = new NGL.Vector3(-1, 0, 0)
                    var m = new NGL.Matrix4()
                    if (tm1_vector.z < 0)
                        m.makeRotationY(v3.angleTo(tm1_vector))
                    else if (tm1_vector.z > 0)
                        m.makeRotationY(-1 * v3.angleTo(tm1_vector))

                    o.setTransform(m)
                }

                o.autoView(":" + pdb_data[mode][0]['chain'] + " and (" + pdb_data[mode][0]['only_gn'].join(", ") + ") and (.CA)")

                // DEBUG: color by values
//                colorByData(mode, 5, 2)
            });

        }).then(function() {
        // TODO: cleanup and reduce redundancy
        if (pdbs_set2) {
            $.getJSON("pdb/" + pdb2,
                function(data) {
                    var highlight = ['TM1', 'TM2', 'TM3', 'TM4', 'TM5', 'TM6', 'TM7', 'H8'];
                    var segments_sets = {}
                    int_labels[mode][1] = {}

                    highlight.forEach(function(e) {
                        segments_sets[e] = ((e in data['segments']) ? data['segments'][e].join(", ") : "")
                    });

                    pdb_data[mode][1] = data;
                    num_set2 = pdb_data[mode][1]['only_gn'];
                    gn_num_set2 = pdb_data[mode][1]['gn_map'];

                    // intersect GN-numbering
                    var matching_TM_residues = [];
                    gn_num_set1.forEach(function(gn, gn_index) {
                        // Filter GN residues, only within 7TM + present in other protein
                        if (gn.charAt(1) == 'x' && gn.charAt(0) <= 7) {
                            var match = gn_num_set2.indexOf(gn);
                            if (match > -1) {
                                return matching_TM_residues.push([num_set1[gn_index], num_set2[match]]);
                            }
                        }
                    });

                    color_schemes[mode][1]['red'] = NGL.ColormakerRegistry.addSelectionScheme([
                        [red_colors[1], segments_sets[highlight[0]]],
                        [red_colors[2], segments_sets[highlight[1]]],
                        [red_colors[3], segments_sets[highlight[2]]],
                        [red_colors[4], segments_sets[highlight[3]]],
                        [red_colors[5], segments_sets[highlight[4]]],
                        [red_colors[6], segments_sets[highlight[5]]],
                        [red_colors[7], segments_sets[highlight[6]]],
                        [red_colors[8], segments_sets[highlight[7]]],
                        ["white", "*"]
                    ])

                    color_schemes[mode][1]['rainbow'] = NGL.ColormakerRegistry.addSelectionScheme([
                        [rb_colors[0], segments_sets[highlight[0]]],
                        [rb_colors[1], segments_sets[highlight[1]]],
                        [rb_colors[2], segments_sets[highlight[2]]],
                        [rb_colors[3], segments_sets[highlight[3]]],
                        [rb_colors[4], segments_sets[highlight[4]]],
                        [rb_colors[5], segments_sets[highlight[5]]],
                        [rb_colors[6], segments_sets[highlight[6]]],
                        [rb_colors[7], segments_sets[highlight[7]]],
                        ["white", "*"]
                    ])

                    color_schemes[mode][1]['grey'] = color_schemes[mode][0]['grey']

                    var stringBlob = new Blob([pdb_data[mode][1]['pdb']], {
                        type: 'text/plain'
                    });
                    stage[mode].loadFile(stringBlob, {
                        ext: "pdb"
                    }).then(function(o) {
                        // Cleanup
                        pdb_data[mode][1]['pdb'] = null;

                        //// SUPERPOSE structures using 7TM bundle ////
                        // Intersect GN-numbering of proteins and create Selection
                        var selectionOne = "(";
                        var selectionTwo = "(";
                        gn_num_set1.forEach(function(gn, gn_index) {
                            // Filter GN residues, only within 7TM + present in other protein
                            if (gn.charAt(1) == 'x' && gn.charAt(0) <= 7) {
                                var match = gn_num_set2.indexOf(gn);
                                if (match > -1) {
                                    if (selectionOne.length > 1) {
                                        selectionOne += " or ";
                                        selectionTwo += " or ";
                                    }
                                    selectionOne += num_set1[gn_index];
                                    selectionTwo += num_set2[match];
                                }
                            }
                        });

                        selectionOne += ") and .CA and :" + pdb_data[mode][0]['chain'];
                        selectionTwo += ") and .CA and :" + pdb_data[mode][1]['chain'];

                        var atoms1 = first_structure.structure.getView(new NGL.Selection(selectionOne))
                        var atoms2 = o.structure.getView(new NGL.Selection(selectionTwo))

                        // Due to superposing apply transformation to second struture
                        var superpose = new NGL.Superposition(atoms2, atoms1)
                        superpose.transform(o.structure)
                        o.structure.refreshPosition()
                        o.updateRepresentations({
                            'position': true
                        })
                        o.setTransform(first_structure.matrix)
                        //// END SUPERPOSE ////

                        gpcr_rep[mode][1] = o.addRepresentation("cartoon", {
                            sele: ":" + pdb_data[mode][1]['chain'] + " and (" + pdb_data[mode][1]['only_gn'].join(", ") + ")",
                            radiusSize: 1,
                            radiusScale: 0.6,
                            color: color_schemes[mode][1]['red'],
                            metalness: 0,
                            colorMode: "hcl",
                            roughness: 1,
                            opacity: 0.4,
                            side: "front",
                            depthWrite: true
                        });

                        // Add residue labels for GN residues
                        pdb_data[mode][1]['only_gn'].forEach(function(resNo, index) {
                            var genNo = pdb_data[mode][1]['gn_map'][index]
                            int_labels[mode][1][o.structure.id + "|" + resNo] = genNo
                        })

                        reps[mode][1].structureComponent = o
                        createNGLRepresentations(mode, 1, false)
                        o.autoView(selectionTwo);
                    });
                });
        }
    });

    var newDiv = document.createElement("div");
    newDiv.setAttribute("style", "position: absolute; top: 45px; left: 20px; background-color: #DDD; opacity: .8; padding: 10px;")
    var controls = '<div class="controls"><span class="pull-right ngl_controls_toggle"><span class="glyphicon glyphicon-option-horizontal btn-download png"></span></span>' +
        '<span class="ngl_control"><h4>Controls</h4>';

    // Toggle for showing two structures simultaneously
    if (mode.startsWith("two_sets") && pdbs_set2)
        two_structures = true;
    else
        two_structures = false;

    if (pdbs) {
        if (two_structures)
            controls += '<p>Structure set 1: <select id="ngl_pdb_' + mode + '_ref">';
        else
            controls += '<p>Structure: <select id="ngl_pdb_' + mode + '_ref">';
        for (var i = 0; i < pdbs.length; i++) {
            if (pdbs[i] == pdb)
                controls += '<option value="' + pdbs[i] + '" SELECTED>' + pdbs[i] + '</option>';
            else
                controls += '<option value="' + pdbs[i] + '">' + pdbs[i] + '</option>';
        }
        controls += '</select></p>';
        if (two_structures)
            controls += '<p>Hide: <input type=checkbox id="hide_pdb1"></p>';
    }
    controls += '<p>Colors: <select id="ngl_color"><option value="blue">blue</option><option value="rainbow">rainbow</option><option value="grey">greys</option></select></p><br/>';


    if (two_structures) {
        if (!pdb2)
            pdb2 = pdbs_set2[0]

        controls += '<p>Structure set 2: <select id="ngl_pdb_' + mode + '_ref2">';
        for (var i = 0; i < pdbs_set2.length; i++) {
            if (pdbs_set2[i] == pdb2)
                controls += '<option value="' + pdbs_set2[i] + '" SELECTED>' + pdbs_set2[i] + '</option>';
            else
                controls += '<option value="' + pdbs_set2[i] + '">' + pdbs_set2[i] + '</option>';
        }
        controls += '</select></p>';
        if (two_structures)
            controls += '<p>Hide: <input type=checkbox id="hide_pdb2"></p>';
        controls += '<p>Colors: <select id="ngl_color2"><option value="red">red</option><option value="rainbow">rainbow</option><option value="grey">greys</option></select></p><br/>';
    }

    controls += '<p>Only GNs: <input type=checkbox id="ngl_only_gns" checked></p>' +
        '<p>Highlight interacting res: <input type=checkbox id="highlight_res" checked></p>' +
        '<p>Hide interaction lines: <input type=checkbox id="toggle_interactions"></p>'
        //                              +'<p>Show all side-chains: <input type=checkbox id="toggle_sidechains"></p>'
        +
        '<p>Show interacting side-chains: <input type=checkbox id="toggle_sidechains_int"></p>'
        //                              +'<p>Show NGL derived contacts: <input type=checkbox id="ngl_contacts"></p>'
        +
        '</div>';
    controls += '</span>';
    newDiv.innerHTML = controls;

    $("#ngl-" + mode).append(newDiv);
    $("#ngl-" + mode + " .ngl_control").hide();
    $('.ngl_controls_toggle').css('cursor', 'pointer');
    $("#ngl-" + mode + " .ngl_controls_toggle").click(function() {
        $("#ngl-" + mode + " .ngl_control").toggle();
    });

    if (two_structures) {
        // structure selection
        $("#ngl_pdb_" + mode + "_ref").change(function(e) {
            createNGLview(mode, $(this).val(), pdbs, pdbs_set2, $("#ngl_pdb_" + mode + "_ref2").val());
        });
        $("#ngl_pdb_" + mode + "_ref2").change(function(e) {
            createNGLview(mode, $("#ngl_pdb_" + mode + "_ref").val(), pdbs, pdbs_set2, $(this).val(), );
        });

        // coloring structure 2
        $("#ngl-" + mode + " #ngl_color2").change(function(e) {
            gpcr_rep[mode][1].setParameters({
                color: color_schemes[mode][1][$(this).val()]
            });
        });
    } else {
        // structure selection
        $("#ngl_pdb_" + mode + "_ref").change(function(e) {
            createNGLview(mode, $(this).val(), pdbs, pdbs_set2);
        });
    }

    $("#ngl-" + mode + " #ngl_color").change(function(e) {
        gpcr_rep[mode][0].setParameters({
            color: color_schemes[mode][0][$(this).val()]
        });
    });


    $("#" + mode + "-NGL-tab-link").click(function(e) {
        $(function() {
            stage[mode].handleResize();
        });
    });

    $("#ngl-" + mode + " #ngl_only_gns").change(function(e) {
        updateStructureRepresentations(mode);
    });

    $("#ngl-" + mode + " #highlight_res").change(function(e) {
        updateStructureRepresentations(mode);
    });

    $("#ngl-" + mode + " #toggle_interactions").change(function(e) {
        updateStructureRepresentations(mode);
    });


    $("#ngl-" + mode + " #hide_pdb1").change(function(e) {
        updateStructureRepresentations(mode);
    });


    $("#ngl-" + mode + " #hide_pdb2").change(function(e) {
        updateStructureRepresentations(mode);
    });

    /*$("#ngl-"+mode+" #toggle_sidechains").change(function(e){
        updateStructureRepresentations(mode);
    });*/

    $("#ngl-" + mode + " #toggle_sidechains_int").change(function(e) {
        updateStructureRepresentations(mode);
    });

    /*$("#ngl-"+mode+" #ngl_contacts").change(function(e){
        updateStructureRepresentations(mode);
    });*/

    // Link the 3D viewers together
    stage[mode].mouseObserver.signals.dragged.add(function() {
        linkNGLMouseControls(mode)
    });
    stage[mode].mouseObserver.signals.scrolled.add(function() {
        linkNGLMouseControls(mode)
    });
    // Click signals not fully functional because of animation -> disabled for now
    //stage[mode].mouseObserver.signals.clicked.add(function (){linkNGLMouseControls(mode)});
    //stage[mode].mouseObserver.signals.doubleClicked.add(function (){linkNGLMouseControls(mode)});

    // Reset 3D view - after short delay
    // OPTIONAL TODO: adjust the 3D view to the view of another viewer (if present)
    setTimeout(function() {
        linkNGLMouseControls(mode)
    }, 100);

    // Prevent scrolling of document
    document.getElementById(mode).onwheel = function(event) {
        event.preventDefault();
    };
    document.getElementById(mode).onmousewheel = function(event) {
        event.preventDefault();
    };
}

function linkNGLMouseControls(origin) {
    var mode = origin.substring(0, origin.length - 1)

    for (var graph in stage) {
        if (graph != origin && graph.startsWith(mode)) {
            stage[graph].viewerControls.orient(stage[origin].viewerControls.getOrientation());
        }
    }
}

function colorByData(mode, tableNumber, columnNumber, type) {
    var defaultColor = "#666";
    var structureKey = 0; // structure number now limited to structure 1
    // TODO: make a switch for the different data tables (or handle in the click handler function?)
    /*     switch (mode) {
             case "single-crystal-group":
               break;
             case "single-crystal":
               break;
             case "two-crystal-groups":
               break;
         }*/

    // Grab data from table
    var rows
    if (mode.startsWith("single_") && tableNumber==1) {
      rows = getDateFromTable(tableNumber, [2, columnNumber].flat());
    } else {
      rows = getDateFromTable(tableNumber, [1, columnNumber].flat());
    }

    // Residue positions
    var residue_positions = getColumn(rows, 0);

    // If residue pairs -> split and concatenate
    if (residue_positions.length == 0)
      return;

    if (residue_positions[0].indexOf("-")>=1){
      residue_positions1 = residue_positions.map(function(e){return e.split("-")[0]});
      residue_positions2 = residue_positions.map(function(e){return e.split("-")[1]});
      residue_positions = residue_positions1.concat(residue_positions2)
    }

    // Filter NaNs
    var residue_values = getColumn(rows, 1)
    if (type!="consensus_SS"){
      residue_values = residue_values.map(function(e){ return parseInt(e);})
      if (Array.isArray(columnNumber) && columnNumber.length > 1)
         residue_values = residue_values.concat(getColumn(rows, 2).map(function(e){ return parseInt(e);}));

      residue_positions = residue_positions.filter( function(value, index){ return !isNaN(residue_values[index]); })
      residue_values = residue_values.filter( function(value, index){ return !isNaN(residue_values[index]); })
    } else {
      // remove positions with no data
      residue_positions = residue_positions.filter( function(value, index){ return !(residue_values==""); })
      residue_values = residue_values.filter( function(value, index){ return !(residue_values==""); })
    }

    // Identify range
    var valMax = Math.max(...residue_values)
    var valMin = Math.min(...residue_values)
    var palette = "rwb"
    if (type in dataType){
      valMax = dataType[type][2]
      valMin = dataType[type][1]
      palette = dataType[type][3]
    } else {
      console.log("TYPE not found: "+type)
    }

    // Create coloring scheme
    color_scheme = []

    // Create gradient scaled by data type
    for (var i = 0; i < residue_positions.length; i++) {
      // Find X-ray residue number
      gn = pdb_data[mode][structureKey]["gn_map"].indexOf(residue_positions[i])

      if (gn >= 0) {
        // create residue selector
        var ngl_selection = ":" + pdb_data[mode][structureKey]['chain'] + " and " + pdb_data[mode][structureKey]["only_gn"][gn]

        // get color
        var newColor = defaultColor;
        if (palette=="ss_coloring") { // coloring for SS
            if (residue_values[i] in SS_COLORING)
              newColor = SS_COLORING[residue_values[i]]
        } else {
          if (valMin < 0)
            newColor = numberToColorGradient(residue_values[i], valMax, palette, neg_and_pos = true)
          else
            newColor = numberToColorGradient(residue_values[i], valMax, palette, neg_and_pos = false)
        }

        // add color + residue to scheme
        color_scheme.push([newColor, ngl_selection])
      }
    }

    // gray for residues not present
    color_scheme.push([ defaultColor, "*" ]);
    color_schemes[mode]['feature'] = NGL.ColormakerRegistry.addSelectionScheme(color_scheme)

    // Assign the coloring to the 3D viewer
    gpcr_rep[mode][structureKey].setParameters({
        color: color_schemes[mode]['feature']
    });

}

// TODO: add smart handling of minimum values (now based on max)
function numberToColorGradient(value, max, palette, neg_and_pos = false) {
    if (neg_and_pos) {
      value = value + max
      max = max*2
    }

    if (value > max)
      value = max
    if (value < 0)
      value = 0

    switch(palette){
        case "rwb": // red-white-blue
          return colorGradient(value/max, {red:255, green:0, blue: 0}, {red:255, green:255, blue: 255}, {red:0, green:0, blue: 255})
          break;
        case "bwr": // blue-white-red
          return colorGradient(value/max, {red:0, green:0, blue: 255}, {red:255, green:255, blue: 255}, {red:255, green:0, blue: 0})
          break;
        case "ryg": // red-yellow-green
          return colorGradient(value/max, {red:255, green:0, blue: 0}, {red:0, green:255, blue: 0}, {red:0, green:255, blue: 0})
          break;
        case "gyr": // green-yellow-red
          return colorGradient(value/max, {red:255, green:0, blue: 0}, {red:255, green:255, blue: 0}, {red:0, green:255, blue: 0})
          break;
        case "rgb":
          return colorGradient(value/max, {red:255, green:0, blue: 0}, {red:255, green:255, blue: 255}, {red:0, green:0, blue: 255})
          break;
        case "wr": // white-red
          return colorGradient(value/max, {red:255, green:255, blue: 255}, {red:255, green:0, blue: 0})
          break;
        case "wg": // white-green
          return colorGradient(value/max, {red:255, green:255, blue: 255}, {red:0, green:255, blue: 0})
          break;
        case "wb": // white-blue
          return colorGradient(value/max, {red:255, green:255, blue: 255}, {red:0, green:0, blue: 255})
          break;
        case "rb": // red-blue
          return colorGradient(value/max, {red:255, green:0, blue: 0}, {red:0, green:0, blue: 255})
          break;
        // ADDON if you're missing gradient values
        case "br": // blue-red
        default:
          return colorGradient(value/max, {red:0, green:0, blue: 255}, {red:255, green:0, blue: 0})
          break;
    }
}

function colorGradient(fadeFraction, rgbColor1, rgbColor2, rgbColor3) {
    var color1 = rgbColor1;
    var color2 = rgbColor2;
    var fade = fadeFraction;

    // Do we have 3 colors for the gradient? Need to adjust the params.
    if (rgbColor3) {
      fade = fade * 2;

      // Find which interval to use and adjust the fade percentage
      if (fade >= 1) {
        fade -= 1;
        color1 = rgbColor2;
        color2 = rgbColor3;
      }
    }

    var diffRed = color2.red - color1.red;
    var diffGreen = color2.green - color1.green;
    var diffBlue = color2.blue - color1.blue;

    var gradient = {
      red: parseInt(Math.floor(color1.red + (diffRed * fade)), 10),
      green: parseInt(Math.floor(color1.green + (diffGreen * fade)), 10),
      blue: parseInt(Math.floor(color1.blue + (diffBlue * fade)), 10),
    };

    return rgb2hexCG(gradient.red.toString(16),gradient.green.toString(16),gradient.blue.toString(16));
}

function rgb2hexCG(r,g,b) {
    if (r.length == 1)
        r = '0' + r;
    if (g.length == 1)
        g = '0' + g;
    if (b.length == 1)
        b = '0' + b;

    return '#' + r + g + b;
}

var linkMap = {}
var linkColourScheme = {}
function createNGLRepresentations(mode, structureNumber, update = false) {
    interactions_data = ''
    if (mode.startsWith("single_group")) {
        mode_short = 'single-group';
        interactions_data = single_set_data;
    } else if (mode.startsWith("single")) {
        mode_short = 'single';
        interactions_data = single_crystal_data;
    } else if (mode.startsWith("two_sets")) {
        mode_short = 'two-groups';
        interactions_data = two_sets_data;
    }

    var links = []
    var res_int = []
    if (mode in reps && structureNumber in reps[mode] && reps[mode][structureNumber].structureComponent)
        var o = reps[mode][structureNumber].structureComponent;
    else
        return // NGL not initialized

    // initialize linkMap + colorScheme
    if (!(mode in linkMap)) linkMap[mode] = {}
    if (!(structureNumber in linkMap[mode])) linkMap[mode][structureNumber] = {}
    if (!(mode in linkColourScheme)) linkColourScheme[mode] = {}

    // remove existing representations
    var enabledInteractions = []
    if (update) {
        // create new links overview
        reps[mode][structureNumber].structureComponent.removeRepresentation(reps[mode][structureNumber].links)
    }

    var gnOnly = !update || $("#ngl-" + mode + " #ngl_only_gns").prop('checked');

    // Get interactions from raw_data
    // console.log('i data',interactions_data);

    if (mode_short == 'single') {
        var addedLinks = []

        // populate enabled interactions
        $('#' + currentTab + " .controls-panel input:checked").each(function(toggle) {
            enabledInteractions.push($(this).data('interaction-type'))
        });

        // Go through interaction table in inverse order (only show strongest color)
        // $($('#single-crystal-tab .heatmap-interaction').get().reverse()).each(function(e) {
        $.each(interactions_data.interactions, function(index, value) {
            var rect = $(this);
            var resNo1 = value['seq_pos'][0];
            var resNo2 = value['seq_pos'][1];
            var genNo1 = index.split(",")[0];
            var genNo2 = index.split(",")[1];
            var iType = value['types'][0]; //get strongest, which is first element.


            var pair = resNo1 + "," + resNo2;
            var pair = genNo1 + "," + genNo2;
            if (!(filtered_gn_pairs.includes(pair)) && filtered_gn_pairs.length) {
                return
            }
            // Interaction type filtering
            // if (update && !enabledInteractions.includes(iType)) return

            // GN interacting residue filtering
            if (gnOnly && ((genNo1 == '-') || (genNo2 == '-'))) return

            // Only show one line - max strength
            if (!addedLinks.includes(resNo1 + "-" + resNo2)) {
                addedLinks.push(resNo1 + "-" + resNo2)

                // add residues to the list when not already there
                if (!res_int.includes(resNo1)) res_int.push(resNo1)
                if (!res_int.includes(resNo2)) res_int.push(resNo2)

                // create link for "distance" representation
                links.push({
                    "atoms": [resNo1 + ":" + pdb_data[mode][structureNumber]['chain'] + ".CA", resNo2 + ":" + pdb_data[mode][structureNumber]['chain'] + ".CA"],
                    "data": {
                        "color": getInteractionColor(iType)
                    },
                    "resID": resNo1 + "-" + resNo2
                })
                int_labels[mode][structureNumber][o.structure.id + "|" + resNo1 + "-" + resNo2] = genNo1 + " - " + genNo2
            }
        });
    } else if (mode_short == 'single-group') {

        // $('#single-crystal-group-tab .heatmap-container .heatmap-interaction').each(function(e) {
        $.each(interactions_data.interactions, function(index, value) {
            var genNo1 = index.split(",")[0];
            var genNo2 = index.split(",")[1];
            var frequency = value['pdbs'].length / interactions_data['pdbs'].length;

            if ((genNo1 == '-') || (genNo2 == '-')) return

            var pair = genNo1 + "," + genNo2;
            if (!(filtered_gn_pairs.includes(pair)) && filtered_gn_pairs.length) {
                return
            }

            // Adjust GN numbering to the shown structure
            var resNo1 = pdb_data[mode][structureNumber]['only_gn'][pdb_data[mode][structureNumber]['gn_map'].indexOf(genNo1)];
            var resNo2 = pdb_data[mode][structureNumber]['only_gn'][pdb_data[mode][structureNumber]['gn_map'].indexOf(genNo2)];

            if ((typeof resNo1 == 'undefined') || (typeof resNo2 == 'undefined')) return

            // Push interactions
            if (!res_int.includes(resNo1)) res_int.push(resNo1)
            if (!res_int.includes(resNo2)) res_int.push(resNo2)

            links.push({
                "atoms": [resNo1 + ":" + pdb_data[mode][structureNumber]['chain'] + ".CA", resNo2 + ":" + pdb_data[mode][structureNumber]['chain'] + ".CA"],
                "data": {
                    "color": getFrequencyColor(frequency)
                },
                "resID": resNo1 + "-" + resNo2
            })
            int_labels[mode][structureNumber][o.structure.id + "|" + resNo1 + "-" + resNo2] = genNo1 + " - " + genNo2
        });
    } else {

        // $('#two-crystal-groups-tab .heatmap-container .heatmap-interaction').each(function(e) {
        var pdbs_1 = interactions_data['pdbs1'].length
        var pdbs_2 = interactions_data['pdbs2'].length
        $.each(interactions_data.interactions, function(index, v) {

            // Generic numbering
            var genNo1 = index.split(",")[0];
            var genNo2 = index.split(",")[1];
            if ((genNo1 == '-') || (genNo2 == '-')) return

            // Link GN numbering to the shown structure
            var resNo1 = pdb_data[mode][structureNumber]['only_gn'][pdb_data[mode][structureNumber]['gn_map'].indexOf(genNo1)];
            var resNo2 = pdb_data[mode][structureNumber]['only_gn'][pdb_data[mode][structureNumber]['gn_map'].indexOf(genNo2)];
            if ((typeof resNo1 == 'undefined') || (typeof resNo2 == 'undefined')) return

            var f1 = Math.round(100 * v['pdbs1'].length / pdbs_1);
            var f2 = Math.round(100 * v['pdbs2'].length / pdbs_2);
            var frequency = f1 - f2;

            var pair = genNo1 + "," + genNo2;
            if (!(filtered_gn_pairs.includes(pair)) && filtered_gn_pairs.length) {
                return
            }

            // Push interacting residues
            if (!res_int.includes(resNo1)) res_int.push(resNo1)
            if (!res_int.includes(resNo2)) res_int.push(resNo2)

            // Only show the links for the most prevalent structure group
            if ((structureNumber == 0 && frequency < 0) || (structureNumber == 1 && frequency >= 0)) return

            // Fix atom IDs for GN loop interactions
            if (resNo1 > resNo2) {
                tmp = resNo1;
                resNo1 = resNo2;
                resNo2 = tmp;
                tmp = genNo1;
                genNo1 = genNo2;
                genNo2 = tmp;
            }

            links.push({
                "atoms": [resNo1 + ":" + pdb_data[mode][structureNumber]['chain'] + ".CA", resNo2 + ":" + pdb_data[mode][structureNumber]['chain'] + ".CA"],
                "data": {
                    "color": getFrequencyColor(-1 * frequency)
                },
                "resID": resNo1 + "-" + resNo2
            })
            int_labels[mode][structureNumber][o.structure.id + "|" + resNo1 + "-" + resNo2] = genNo1 + " - " + genNo2
        });
    }

    links.forEach(function(link) {
        linkMap[mode][structureNumber][link.resID] = link
    })

    // create coloring scale for the links
    linkColourScheme[mode][structureNumber] = function() {
        this.bondColor = function(b) {
            var origLink = linkMap[mode][structureNumber][b.atom1.resno + "-" + b.atom2.resno]
            if (origLink) {
                r = origLink.data.color
                return (r["r"] << 16) + (r["g"] << 8) + r["b"]
            }
            return (8 << 16) + (8 << 8) + 8 // (128 << 16) + (128 << 8) + 128 // grey default
        }
    }
    reps[mode][structureNumber].linkColourScheme = NGL.ColormakerRegistry.addScheme(linkColourScheme[mode][structureNumber], "xlink")

    reps[mode][structureNumber].links = o.addRepresentation("distance", {
        atomPair: links.map(function(l) {
            return l.atoms
        }),
        colorScheme: reps[mode][structureNumber].linkColourScheme,
        useCylinder: true,
        radiusSize: 0.04,
        labelVisible: false,
        linewidth: 2,
        visible: true
    })

    // Empty? Update selection with a fake residue -> hide everything
    if (res_int.length == 0) res_int.push("9999999")

    if (update) {
        reps[mode][structureNumber].int_res.setSelection(":" + pdb_data[mode][structureNumber]['chain'] + " and (" + res_int.join(", ") + ") and (.CA)")
        reps[mode][structureNumber].ball_int.setSelection(":" + pdb_data[mode][structureNumber]['chain'] + " and (" + res_int.join(", ") + ") and sidechainAttached")
    } else {
        reps[mode][structureNumber].int_res = o.addRepresentation("spacefill", {
            sele: ":" + pdb_data[mode][structureNumber]['chain'] + " and (" + res_int.join(", ") + ") and (.CA)",
            color: (structureNumber == 0 ? "#084081" : "#811808"),
            radiusScale: .2,
            name: "res",
            visible: true
        });

        reps[mode][structureNumber].ball_int = o.addRepresentation("ball+stick", {
            sele: ":" + pdb_data[mode][structureNumber]['chain'] + " and (" + res_int.join(", ") + ") and sidechainAttached",
            color: "element",
            colorValue: (structureNumber == 0 ? "#99B5CC" : "#DDA8BC"),
            visible: false
        })
    }

    // update show/hide when updating representations
    if (update) updateStructureRepresentations(mode)
}
