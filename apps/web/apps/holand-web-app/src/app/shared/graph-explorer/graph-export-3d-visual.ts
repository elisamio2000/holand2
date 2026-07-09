/**
 * 3D export visual preset — soft Lambert nodes; links use linkColorFaded3d + linkOpacity in html builder.
 * Glow on: Lambert core + soft halo. Glow off: library spheres via nodeColor (return false).
 */

export function buildExport3dVisualScript(): string {
  return `
    // WHY direct mesh control: 3d-force-graph's nodeOpacity / nodeRelSize do NOT
    // affect custom nodeThreeObject meshes, so size & opacity must be applied to
    // the THREE materials/scale directly (see applyNodeVisualSettings()).
    function buildNodeMesh(n) {
      var col = resolveNodeColor(n);
      var r = nodeRadius(n);
      var nodeOp = (typeof visualSettings !== 'undefined') ? visualSettings.nodeOpacityBase : 1;
      var sizeMult = (typeof visualSettings !== 'undefined') ? visualSettings.nodeSizeMult : 1;
      var group = new THREE.Group();
      group.userData.nodeId = n.id;
      if (visual.glow) {
        var haloMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12 * nodeOp, depthWrite: false });
        haloMat.userData = { baseOpacity: 0.12 };
        var halo = new THREE.Mesh(new THREE.SphereGeometry(r * 1.5, 14, 14), haloMat);
        group.add(halo);
      }
      var coreMat = new THREE.MeshLambertMaterial({
        color: col,
        emissive: new THREE.Color(col),
        emissiveIntensity: visual.glow ? 0.42 : 0.2,
        transparent: true,
        opacity: 1 * nodeOp
      });
      coreMat.userData = { baseOpacity: 1 };
      var core = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 18), coreMat);
      group.add(core);
      group.scale.setScalar(sizeMult);
      return group;
    }

    // Apply node size (group scale) + node opacity (material opacity) to every
    // custom node mesh in the scene. Safe to call on every slider input.
    function applyNodeVisualSettings() {
      if (!graph || typeof graph.scene !== 'function' || typeof visualSettings === 'undefined') return;
      var sizeMult = visualSettings.nodeSizeMult;
      var opMult = visualSettings.nodeOpacityBase;
      graph.scene().traverse(function (obj) {
        if (!obj.userData || obj.userData.nodeId == null) return;
        obj.scale.setScalar(sizeMult);
        for (var i = 0; i < obj.children.length; i++) {
          var child = obj.children[i];
          if (!child.material) continue;
          child.material.transparent = true;
          var base = (child.material.userData && child.material.userData.baseOpacity != null)
            ? child.material.userData.baseOpacity : 1;
          child.material.opacity = base * opMult;
          child.material.needsUpdate = true;
        }
      });
    }

    function boostSceneLights() {
      if (!graph || typeof graph.scene !== 'function') return;
      graph.scene().traverse(function (obj) {
        if (obj.isAmbientLight) obj.intensity = 1.85;
        if (obj.isDirectionalLight) {
          obj.intensity = 1.35;
          obj.color.setHex(0xf1f5f9);
        }
      });
    }

    function addStarfield() {
      if (!graph || typeof graph.scene !== 'function') return;
      if (graph.scene().getObjectByName('export-starfield')) return;
      var n = 420;
      var pos = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        var R = 2200 + Math.random() * 1800;
        var theta = Math.random() * Math.PI * 2;
        var phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = R * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = R * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = R * Math.cos(phi);
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var pts = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: 0x64748b, size: 1.8, sizeAttenuation: true, transparent: true, opacity: 0.55 })
      );
      pts.name = 'export-starfield';
      graph.scene().add(pts);
    }

    function restoreExport3dSceneDecor() {
      boostSceneLights();
      addStarfield();
    }

    function refreshVisuals() {
      graph.nodeColor(graph.nodeColor());
      graph.linkColor(graph.linkColor());
      if (typeof graph.linkDirectionalParticles === 'function') {
        graph.linkDirectionalParticles(graph.linkDirectionalParticles());
      }
      if (typeof graph.linkOpacity === 'function') {
        graph.linkOpacity(graph.linkOpacity());
      }
      if (typeof graph.nodeOpacity === 'function') {
        graph.nodeOpacity(graph.nodeOpacity());
      }
      if (visual.glow && typeof graph.nodeThreeObject === 'function') {
        graph.nodeThreeObject(graph.nodeThreeObject());
        var gd = graph.graphData();
        graph.graphData({ nodes: [], links: [] });
        graph.graphData(gd);
        restoreExport3dSceneDecor();
      }
      // Re-apply node size/opacity after meshes are (re)built.
      if (typeof applyNodeVisualSettings === 'function') {
        setTimeout(applyNodeVisualSettings, 60);
      }
    }
  `;
}
