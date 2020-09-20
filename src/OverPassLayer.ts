import * as L from "leaflet";
import * as ClipperLib from "js-clipper";
import { openDB } from "idb";
import "./OverPassLayer.css";
import "./MinZoomIndicator";
import * as md5 from "md5";

const OverPassLayer = L.FeatureGroup.extend({
  options: {
    debug: false,
    minZoom: 15,
    endPoints: [
      { url: "https://overpass-api.de/api/", extendQuerySupport: true },
      { url: "https://overpass.kumi.systems/api/", extendQuerySupport: true },
      { url: "https://overpass.nchc.org.tw/api/", extendQuerySupport: false },
      {
        url: "https://overpass.openstreetmap.ru/cgi/",
        extendQuerySupport: false
      },
      {
        url: "https://overpass.osm.ch/api/",
        extendQuerySupport: false,
        bounds: [45.818, 5.9559, 47.8085, 10.4923]
      }
    ],
    query: "(node[organic];node[fair_trade];node[second_hand];);out qt;",
    loadedBounds: [],
    markerIcon: null,
    timeout: 30, // Seconds
    retryOnTimeout: false,
    noInitialRequest: false,
    cacheEnabled: true,
    cacheTTL: 1800, // Seconds

    beforeRequest() {},

    afterRequest() {},

    onSuccess(data: any) {
      for (let i = 0; i < data.elements.length; i++) {
        let pos;
        let marker;
        const e = data.elements[i];

        if (e.id in (this as any)._ids) {
          continue;
        }

        (this as any)._ids[e.id] = true;

        if (e.type === "node") {
          pos = L.latLng(e.lat, e.lon);
        } else {
          pos = L.latLng(e.center.lat, e.center.lon);
        }

        if ((this as any).options.markerIcon) {
          marker = L.marker(pos, { icon: (this as any).options.markerIcon });
        } else {
          marker = L.circle(pos, 20, {
            stroke: false,
            fillColor: "#E54041",
            fillOpacity: 0.9
          });
        }

        const popupContent = (this as any)._getPoiPopupHTML(e.tags, e.id);
        const popup = L.popup().setContent(popupContent);
        marker.bindPopup(popup);

        (this as any)._markers.addLayer(marker);
      }
    },

    onError() {},

    onTimeout() {},

    minZoomIndicatorEnabled: true,
    minZoomIndicatorOptions: {
      minZoomMessageNoLayer: "No layer assigned",
      minZoomMessage:
        "Current zoom Level: CURRENTZOOM. Data are visible at Level: MINZOOMLEVEL."
    }
  },

  async _initDB() {
    (this as any)._db = await openDB(md5((this as any).options.query), 1, {
      upgrade(db) {
        db.createObjectStore("cache", { autoIncrement: true });
      }
    });

    let items = await (this as any)._db.getAll("cache");
    let keys = await (this as any)._db.getAllKeys("cache");

    items.forEach((item: any, i: any) => {
      if (new Date() > item.expires) {
        (this as any)._db.delete("cache", keys[i]);
      } else {
        (this as any).options.onSuccess.call(this, item.result);
        (this as any)._onRequestLoadCallback(item.bounds);
      }
    });

    if (!(this as any).options.noInitialRequest) {
      (this as any)._prepareRequest();
    }
  },

  initialize(options) {
    L.Util.setOptions(this, options);

    // Random endpoint
    (this as any)._endPointsIndex = Math.floor(
      Math.random() * (this as any).options.endPoints.length
    );
    (this as any)._ids = {};
    (this as any)._loadedBounds = options.loadedBounds || [];
    (this as any)._requestInProgress = false;

    if ((this as any).options.cacheEnabled) {
      (this as any)._initDB();
    }
  },

  _getPoiPopupHTML(tags, id) {
    let row;
    const link = document.createElement("a");
    const table = document.createElement("table");
    const div = document.createElement("div");

    link.href = `https://www.openstreetmap.org/edit?editor=id&node=${id}`;
    link.appendChild(document.createTextNode("Edit this entry in iD"));

    table.style.borderSpacing = "10px";
    table.style.borderCollapse = "separate";

    for (const key in tags) {
      row = table.insertRow(0);
      row.insertCell(0).appendChild(document.createTextNode(key));
      row.insertCell(1).appendChild(document.createTextNode(tags[key]));
    }

    div.appendChild(link);
    div.appendChild(table);

    return div;
  },

  _buildRequestBox(bounds) {
    return L.rectangle(bounds, {
      bounds: bounds,
      color: "#204a87",
      stroke: false,
      fillOpacity: 0.1,
      clickable: false
    } as any);
  },

  _addRequestBox(box) {
    return (this as any)._requestBoxes.addLayer(box);
  },

  _getRequestBoxes() {
    return (this as any)._requestBoxes.getLayers();
  },

  _removeRequestBox(box) {
    (this as any)._requestBoxes.removeLayer(box);
  },

  _removeRequestBoxes() {
    return (this as any)._requestBoxes.clearLayers();
  },

  _addResponseBox(box) {
    return (this as any)._responseBoxes.addLayer(box);
  },

  _addResponseBoxes(requestBoxes) {
    (this as any)._removeRequestBoxes();

    requestBoxes.forEach((box: any) => {
      box.setStyle({
        color: "black",
        weight: 2
      });
      (this as any)._addResponseBox(box);
    });
  },

  _isFullyLoadedBounds(bounds, loadedBounds) {
    if (loadedBounds.length === 0) {
      return false;
    }

    const subjectClips = (this as any)._buildClipsFromBounds([bounds]);
    const knownClips = (this as any)._buildClipsFromBounds(loadedBounds);
    const clipper = new ClipperLib.Clipper();
    const solutionPolyTree = new ClipperLib.PolyTree();

    (clipper as any).AddPaths(
      subjectClips,
      ClipperLib.PolyType.ptSubject,
      true
    );
    (clipper as any).AddPaths(knownClips, ClipperLib.PolyType.ptClip, true);

    clipper.Execute(
      ClipperLib.ClipType.ctDifference,
      solutionPolyTree,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero
    );

    const solutionExPolygons = ClipperLib.JS.PolyTreeToExPolygons(
      solutionPolyTree
    );

    if (solutionExPolygons.length === 0) {
      return true;
    } else {
      return false;
    }
  },

  _getLoadedBounds() {
    return (this as any)._loadedBounds;
  },

  _addLoadedBounds(bounds) {
    (this as any)._loadedBounds.push(bounds);
  },

  _buildClipsFromBounds(bounds) {
    return bounds.map((bound: any) => [
      {
        X: bound._southWest.lng * 1000000,
        Y: bound._southWest.lat * 1000000
      },
      {
        X: bound._southWest.lng * 1000000,
        Y: bound._northEast.lat * 1000000
      },
      {
        X: bound._northEast.lng * 1000000,
        Y: bound._northEast.lat * 1000000
      },
      {
        X: bound._northEast.lng * 1000000,
        Y: bound._southWest.lat * 1000000
      }
    ]);
  },

  _buildBoundsFromClips(clips) {
    return clips.map((clip: any) =>
      L.latLngBounds(
        L.latLng(clip[0].Y / 1000000, clip[0].X / 1000000).wrap(),
        L.latLng(clip[2].Y / 1000000, clip[2].X / 1000000).wrap()
      )
    );
  },

  _buildOverpassUrlFromEndPointAndQuery(endPoint, query, bounds) {
    const sw = bounds._southWest;
    const ne = bounds._northEast;
    const coordinates = [sw.lat, sw.lng, ne.lat, ne.lng].join(",");

    if (!endPoint.extendQuerySupport) {
      query = query.replace(
        /([(;/\s])nw((\[.*])*(\(.*\))*;)/gim,
        "$1node$2way$2"
      );
      query = query.replace(
        /([(;/\s])nr((\[.*])*(\(.*\))*;)/gim,
        "$1node$2relation$2"
      );
      query = query.replace(
        /([(;/\s])wr((\[.*])*(\(.*\))*;)/gim,
        "$1way$2relation$2"
      );
    }

    query = query.replace(/(\/\/.*)/g, "");

    return `${endPoint.url}interpreter?data=[out:json][timeout:${
      (this as any).options.timeout
    }][bbox:${coordinates}];${query}`;
  },

  _buildLargerBounds(bounds) {
    const width = Math.abs(bounds._northEast.lng - bounds._southWest.lng);
    const height = Math.abs(bounds._northEast.lat - bounds._southWest.lat);

    bounds._southWest.lat -= height / 2;
    bounds._southWest.lng -= width / 2;
    bounds._northEast.lat += height / 2;
    bounds._northEast.lng += width / 2;

    return L.latLngBounds(
      L.latLng(bounds._southWest.lat, bounds._southWest.lng).wrap(),
      L.latLng(bounds._northEast.lat, bounds._northEast.lng).wrap()
    );
  },

  _setRequestInProgress(isInProgress) {
    (this as any)._requestInProgress = isInProgress;
  },

  _isRequestInProgress() {
    return (this as any)._requestInProgress;
  },

  _hasNextRequest() {
    if ((this as any)._nextRequest) {
      return true;
    }

    return false;
  },

  _getNextRequest() {
    return (this as any)._nextRequest;
  },

  _setNextRequest(nextRequest) {
    (this as any)._nextRequest = nextRequest;
  },

  _removeNextRequest() {
    (this as any)._nextRequest = null;
  },

  _prepareRequest() {
    if ((this as any)._map.getZoom() < (this as any).options.minZoom) {
      return false;
    }

    const bounds = (this as any)._buildLargerBounds(
      (this as any)._map.getBounds()
    );
    const nextRequest = (this as any)._sendRequest.bind(this, bounds);

    if ((this as any)._isRequestInProgress()) {
      (this as any)._setNextRequest(nextRequest);
    } else {
      (this as any)._removeNextRequest();
      nextRequest();
    }
  },

  _retry(bounds) {
    (this as any)._nextEndPoint(bounds);
    (this as any)._sendRequest(bounds);
  },

  _nextEndPoint(requestBounds) {
    if (
      (this as any)._endPointsIndex <
      (this as any).options.endPoints.length - 1
    ) {
      (this as any)._endPointsIndex++;
    } else {
      (this as any)._endPointsIndex = 0;
    }

    if ((this as any)._endPointSupportsBounds(requestBounds))
      (this as any)._nextEndPoint(requestBounds);
  },

  _sendRequest(bounds) {
    const loadedBounds = (this as any)._getLoadedBounds();

    if ((this as any)._isFullyLoadedBounds(bounds, loadedBounds)) {
      (this as any)._setRequestInProgress(false);
      return;
    }

    const requestBounds = (this as any)._buildLargerBounds(bounds);

    if ((this as any)._endPointSupportsBounds(requestBounds))
      (this as any)._nextEndPoint(requestBounds);

    const url = (this as any)._buildOverpassUrlFromEndPointAndQuery(
      (this as any).options.endPoints[(this as any)._endPointsIndex],
      (this as any).options.query,
      requestBounds
    );
    const request = new XMLHttpRequest();
    const beforeRequestResult = (this as any).options.beforeRequest.call(this);

    if (beforeRequestResult === false) {
      (this as any).options.afterRequest.call(this);

      return;
    }

    (this as any)._setRequestInProgress(true);

    if ((this as any).options.debug) {
      (this as any)._addRequestBox(
        (this as any)._buildRequestBox(requestBounds)
      );
    }

    request.open("GET", url, true);
    request.timeout = (this as any).options.timeout * 1000;

    request.ontimeout = () =>
      (this as any)._onRequestTimeout(request, url, requestBounds);
    request.onerror = () => {
      (this as any)._onRequestErrorCallback(requestBounds);

      (this as any).options.onError.call(this, request);

      (this as any)._retry(bounds);
    };
    request.onload = () => (this as any)._onRequestLoad(request, requestBounds);

    request.send();
  },

  _endPointSupportsBounds(bounds) {
    const supportedBounds = (this as any).options.endPoints[
      (this as any)._endPointsIndex
    ].bounds;
    return (
      supportedBounds &&
      !L.latLngBounds([
        [supportedBounds[0], supportedBounds[1]],
        [supportedBounds[2], supportedBounds[3]]
      ]).contains(bounds)
    );
  },

  _onRequestLoad(xhr, bounds) {
    if (xhr.status >= 200 && xhr.status < 400) {
      let result = JSON.parse(xhr.response);
      (this as any).options.onSuccess.call(this, result);

      if ((this as any).options.cacheEnabled) {
        let expireDate = new Date();
        expireDate.setSeconds(
          expireDate.getSeconds() + (this as any).options.cacheTTL
        );

        (this as any)._db.put("cache", {
          result: result,
          bounds: bounds,
          expires: expireDate
        });
      }

      (this as any)._onRequestLoadCallback(bounds);
    } else {
      (this as any)._onRequestErrorCallback(bounds);

      (this as any).options.onError.call(this, xhr);

      (this as any)._retry(bounds);
    }

    (this as any)._onRequestCompleteCallback(bounds);
  },

  _onRequestTimeout(xhr, url, bounds) {
    (this as any).options.onTimeout.call(this, xhr);

    if ((this as any).options.retryOnTimeout) {
      (this as any)._retry(bounds);
    } else {
      (this as any)._onRequestErrorCallback(bounds);
      (this as any)._onRequestCompleteCallback(bounds);
    }
  },

  _onRequestLoadCallback(bounds) {
    (this as any)._addLoadedBounds(bounds);

    if ((this as any).options.debug) {
      (this as any)._addResponseBoxes((this as any)._getRequestBoxes());
    }
  },

  _onRequestErrorCallback(bounds) {
    if ((this as any).options.debug) {
      (this as any)._removeRequestBox((this as any)._buildRequestBox(bounds));
    }
  },

  _onRequestCompleteCallback() {
    (this as any).options.afterRequest.call(this);

    if ((this as any)._hasNextRequest()) {
      const nextRequest = (this as any)._getNextRequest();

      (this as any)._removeNextRequest();

      nextRequest();
    } else {
      (this as any)._setRequestInProgress(false);
    }
  },

  onAdd(map) {
    (this as any)._map = map;

    if ((this as any).options.minZoomIndicatorEnabled === true) {
      if ((this as any)._map.zoomIndicator) {
        (this as any)._zoomControl = (this as any)._map.zoomIndicator;
        (this as any)._zoomControl._addLayer(this);
      } else {
        (this as any)._zoomControl = new L.Control.MinZoomIndicator(
          (this as any).options.minZoomIndicatorOptions
        );

        (this as any)._map.addControl((this as any)._zoomControl);

        (this as any)._zoomControl._addLayer(this);
      }
    }

    if ((this as any).options.debug) {
      (this as any)._requestBoxes = L.featureGroup().addTo((this as any)._map);
      (this as any)._responseBoxes = L.featureGroup().addTo((this as any)._map);
    }

    (this as any)._markers = L.featureGroup().addTo((this as any)._map);

    if (
      !(this as any).options.noInitialRequest &&
      !(this as any).options.cacheEnabled
    ) {
      (this as any)._prepareRequest();
    }

    (this as any)._map.on("moveend", (this as any)._prepareRequest, this);
  },

  onRemove(map) {
    L.LayerGroup.prototype.onRemove.call(this, map);

    (this as any)._resetData();

    map.off("moveend", (this as any)._prepareRequest, this);

    (this as any)._map = null;
  },

  setQuery(query) {
    (this as any).options.query = query;
    (this as any)._resetData();

    if ((this as any).options.cacheEnabled) {
      (this as any)._initDB();
    }

    (this as any)._prepareRequest();
  },

  _resetData() {
    (this as any)._ids = {};
    (this as any)._loadedBounds = [];
    (this as any)._requestInProgress = false;

    (this as any)._markers.clearLayers();

    if ((this as any).options.debug) {
      (this as any)._requestBoxes.clearLayers();
      (this as any)._responseBoxes.clearLayers();
    }
  },

  getData() {
    return (this as any)._data;
  }
} as L.IOverPassLayer);

(L as any).OverPassLayer = OverPassLayer;
(L as any).overpassLayer = (options: L.OverPassLayerOptions) =>
  new L.OverPassLayer(options as any);

export default L;
