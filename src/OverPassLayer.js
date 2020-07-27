import L from "leaflet";
import ClipperLib from "js-clipper";
import { openDB } from "idb";
import "./OverPassLayer.css";
import "./MinZoomIndicator";
import md5 from "md5";

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

    onSuccess(data) {
      for (let i = 0; i < data.elements.length; i++) {
        let pos;
        let marker;
        const e = data.elements[i];

        if (e.id in this._ids) {
          continue;
        }

        this._ids[e.id] = true;

        if (e.type === "node") {
          pos = L.latLng(e.lat, e.lon);
        } else {
          pos = L.latLng(e.center.lat, e.center.lon);
        }

        if (this.options.markerIcon) {
          marker = L.marker(pos, { icon: this.options.markerIcon });
        } else {
          marker = L.circle(pos, 20, {
            stroke: false,
            fillColor: "#E54041",
            fillOpacity: 0.9
          });
        }

        const popupContent = this._getPoiPopupHTML(e.tags, e.id);
        const popup = L.popup().setContent(popupContent);
        marker.bindPopup(popup);

        this._markers.addLayer(marker);
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
    this._db = await openDB(md5(this.options.query), 1, {
      upgrade(db) {
        db.createObjectStore("cache", { autoIncrement: true });
      }
    });

    let items = await this._db.getAll("cache");
    let keys = await this._db.getAllKeys("cache");

    items.forEach((item, i) => {
      if (new Date() > item.expires) {
        this._db.delete("cache", keys[i]);
      } else {
        this.options.onSuccess.call(this, item.result);
        this._onRequestLoadCallback(item.bounds);
      }
    });

    if (!this.options.noInitialRequest) {
      this._prepareRequest();
    }
  },

  initialize(options) {
    L.Util.setOptions(this, options);

    // Random endpoint
    this._endPointsIndex = Math.floor(
      Math.random() * this.options.endPoints.length
    );
    this._ids = {};
    this._loadedBounds = options.loadedBounds || [];
    this._requestInProgress = false;

    if (this.options.cacheEnabled) {
      this._initDB();
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
    });
  },

  _addRequestBox(box) {
    return this._requestBoxes.addLayer(box);
  },

  _getRequestBoxes() {
    return this._requestBoxes.getLayers();
  },

  _removeRequestBox(box) {
    this._requestBoxes.removeLayer(box);
  },

  _removeRequestBoxes() {
    return this._requestBoxes.clearLayers();
  },

  _addResponseBox(box) {
    return this._responseBoxes.addLayer(box);
  },

  _addResponseBoxes(requestBoxes) {
    this._removeRequestBoxes();

    requestBoxes.forEach(box => {
      box.setStyle({
        color: "black",
        weight: 2
      });
      this._addResponseBox(box);
    });
  },

  _isFullyLoadedBounds(bounds, loadedBounds) {
    if (loadedBounds.length === 0) {
      return false;
    }

    const subjectClips = this._buildClipsFromBounds([bounds]);
    const knownClips = this._buildClipsFromBounds(loadedBounds);
    const clipper = new ClipperLib.Clipper();
    const solutionPolyTree = new ClipperLib.PolyTree();

    clipper.AddPaths(subjectClips, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(knownClips, ClipperLib.PolyType.ptClip, true);

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
    return this._loadedBounds;
  },

  _addLoadedBounds(bounds) {
    this._loadedBounds.push(bounds);
  },

  _buildClipsFromBounds(bounds) {
    return bounds.map(bound => [
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
    return clips.map(clip =>
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

    return `${endPoint.url}interpreter?data=[out:json][timeout:${this.options.timeout}][bbox:${coordinates}];${query}`;
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
    this._requestInProgress = isInProgress;
  },

  _isRequestInProgress() {
    return this._requestInProgress;
  },

  _hasNextRequest() {
    if (this._nextRequest) {
      return true;
    }

    return false;
  },

  _getNextRequest() {
    return this._nextRequest;
  },

  _setNextRequest(nextRequest) {
    this._nextRequest = nextRequest;
  },

  _removeNextRequest() {
    this._nextRequest = null;
  },

  _prepareRequest() {
    if (this._map.getZoom() < this.options.minZoom) {
      return false;
    }

    const bounds = this._buildLargerBounds(this._map.getBounds());
    const nextRequest = this._sendRequest.bind(this, bounds);

    if (this._isRequestInProgress()) {
      this._setNextRequest(nextRequest);
    } else {
      this._removeNextRequest();
      nextRequest();
    }
  },

  _retry(bounds) {
    this._nextEndPoint(bounds);
    this._sendRequest(bounds);
  },

  _nextEndPoint(requestBounds) {
    if (this._endPointsIndex < this.options.endPoints.length - 1) {
      this._endPointsIndex++;
    } else {
      this._endPointsIndex = 0;
    }

    if (this._endPointSupportsBounds(requestBounds))
      this._nextEndPoint(requestBounds);
  },

  _sendRequest(bounds) {
    const loadedBounds = this._getLoadedBounds();

    if (this._isFullyLoadedBounds(bounds, loadedBounds)) {
      this._setRequestInProgress(false);
      return;
    }

    const requestBounds = this._buildLargerBounds(bounds);

    if (this._endPointSupportsBounds(requestBounds))
      this._nextEndPoint(requestBounds);

    const url = this._buildOverpassUrlFromEndPointAndQuery(
      this.options.endPoints[this._endPointsIndex],
      this.options.query,
      requestBounds
    );
    const request = new XMLHttpRequest();
    const beforeRequestResult = this.options.beforeRequest.call(this);

    if (beforeRequestResult === false) {
      this.options.afterRequest.call(this);

      return;
    }

    this._setRequestInProgress(true);

    if (this.options.debug) {
      this._addRequestBox(this._buildRequestBox(requestBounds));
    }

    request.open("GET", url, true);
    request.timeout = this.options.timeout * 1000;

    request.ontimeout = () =>
      this._onRequestTimeout(request, url, requestBounds);
    request.onerror = () => {
      this._onRequestErrorCallback(requestBounds);

      this.options.onError.call(this, request);

      this._retry(bounds);
    };
    request.onload = () => this._onRequestLoad(request, requestBounds);

    request.send();
  },

  _endPointSupportsBounds(bounds) {
    const supportedBounds = this.options.endPoints[this._endPointsIndex].bounds;
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
      this.options.onSuccess.call(this, result);

      if (this.options.cacheEnabled) {
        let expireDate = new Date();
        expireDate.setSeconds(expireDate.getSeconds() + this.options.cacheTTL);

        this._db.put("cache", {
          result: result,
          bounds: bounds,
          expires: expireDate
        });
      }

      this._onRequestLoadCallback(bounds);
    } else {
      this._onRequestErrorCallback(bounds);

      this.options.onError.call(this, xhr);

      this._retry(bounds);
    }

    this._onRequestCompleteCallback(bounds);
  },

  _onRequestTimeout(xhr, url, bounds) {
    this.options.onTimeout.call(this, xhr);

    if (this.options.retryOnTimeout) {
      this._retry(bounds);
    } else {
      this._onRequestErrorCallback(bounds);
      this._onRequestCompleteCallback(bounds);
    }
  },

  _onRequestLoadCallback(bounds) {
    this._addLoadedBounds(bounds);

    if (this.options.debug) {
      this._addResponseBoxes(this._getRequestBoxes());
    }
  },

  _onRequestErrorCallback(bounds) {
    if (this.options.debug) {
      this._removeRequestBox(this._buildRequestBox(bounds));
    }
  },

  _onRequestCompleteCallback() {
    this.options.afterRequest.call(this);

    if (this._hasNextRequest()) {
      const nextRequest = this._getNextRequest();

      this._removeNextRequest();

      nextRequest();
    } else {
      this._setRequestInProgress(false);
    }
  },

  onAdd(map) {
    this._map = map;

    if (this.options.minZoomIndicatorEnabled === true) {
      if (this._map.zoomIndicator) {
        this._zoomControl = this._map.zoomIndicator;
        this._zoomControl._addLayer(this);
      } else {
        this._zoomControl = new L.Control.MinZoomIndicator(
          this.options.minZoomIndicatorOptions
        );

        this._map.addControl(this._zoomControl);

        this._zoomControl._addLayer(this);
      }
    }

    if (this.options.debug) {
      this._requestBoxes = L.featureGroup().addTo(this._map);
      this._responseBoxes = L.featureGroup().addTo(this._map);
    }

    this._markers = L.featureGroup().addTo(this._map);

    if (!this.options.noInitialRequest && !this.options.cacheEnabled) {
      this._prepareRequest();
    }

    this._map.on("moveend", this._prepareRequest, this);
  },

  onRemove(map) {
    L.LayerGroup.prototype.onRemove.call(this, map);

    this._resetData();

    map.off("moveend", this._prepareRequest, this);

    this._map = null;
  },

  setQuery(query) {
    this.options.query = query;
    this._resetData();

    if (this.options.cacheEnabled) {
      this._initDB();
    }

    this._prepareRequest();
  },

  _resetData() {
    this._ids = {};
    this._loadedBounds = [];
    this._requestInProgress = false;

    this._markers.clearLayers();

    if (this.options.debug) {
      this._requestBoxes.clearLayers();
      this._responseBoxes.clearLayers();
    }
  },

  getData() {
    return this._data;
  }
});

L.OverPassLayer = OverPassLayer;
L.overpassLayer = options => new L.OverPassLayer(options);

export default OverPassLayer;
