import * as L from 'leaflet';
import * as ClipperLib from 'js-clipper';
import { openDB } from 'idb';
import './OverPassLayer.css';
import './MinZoomIndicator';
import * as md5 from 'md5';
import MinZoomIndicator, {
  MapWithZoomIndicator,
  MinZoomIndicatorOptions,
} from './MinZoomIndicator';
import * as OverPass from './OverPass';

const overPassLayer = L.FeatureGroup.extend({
  _responseBoxes: undefined,
  _nextRequest: undefined,
  _map: undefined,
  _zoomControl: undefined,
  _data: undefined,
  _markers: undefined,
  _db: undefined,
  _loadedBounds: [],
  _requestInProgress: false,
  _endPointsIndex: 0,
  _ids: {},
  _requestBoxes: undefined,
  options: {
    debug: false,
    minZoom: 15,
    endPoints: [
      { url: 'https://overpass-api.de/api/', extendQuerySupport: true },
      { url: 'https://overpass.kumi.systems/api/', extendQuerySupport: true },
      {
        url: 'https://overpass.openstreetmap.ru/api/',
        extendQuerySupport: true,
      },
      {
        url: 'https://maps.mail.ru/osm/tools/overpass/api/',
        extendQuerySupport: true,
      },
      {
        url: 'https://overpass.osm.ch/api/',
        extendQuerySupport: true,
        bounds: [45.818, 5.9559, 47.8085, 10.4923],
      },
    ],
    query: '(node[organic];node[fair_trade];node[second_hand];);out qt;',
    loadedBounds: [],
    markerIcon: null,
    timeout: 30, // Seconds
    retryOnTimeout: false,
    noInitialRequest: false,
    cacheEnabled: true,
    cacheTTL: 1800, // Seconds

    beforeRequest() {},

    afterRequest() {},

    onSuccess(this: L.IOverPassLayer, data: OverPass.RootObject) {
      for (let i = 0; i < data.elements.length; i++) {
        let pos;
        let marker;
        const e = data.elements[i];

        if (e.id in this._ids) {
          continue;
        }

        this._ids[e.id] = true;

        if (e.type === 'node') {
          if (e.lat && e.lon) pos = L.latLng(e.lat, e.lon);
          else throw 'Unexpected undefined: e.lat && e.lon';
        } else {
          if (e.center && e.center.lat && e.center.lon)
            pos = L.latLng(e.center.lat, e.center.lon);
          else
            throw 'Unexpected undefined: e.center && e.center.lat && e.center.lon';
        }

        if (this.options.markerIcon) {
          marker = L.marker(pos, { icon: this.options.markerIcon });
        } else {
          marker = L.circle(pos, 20, {
            stroke: false,
            fillColor: '#E54041',
            fillOpacity: 0.9,
          });
        }

        if (!e.tags) throw 'Unexpected undefined: e.tags';

        const popupContent = this._getPoiPopupHTML(e.tags, e.id);
        const popup = L.popup().setContent(popupContent);
        marker.bindPopup(popup);

        if (this._markers) this._markers.addLayer(marker);
        else throw 'Unexpected undefined: this._markers';
      }
    },

    onError() {},

    onTimeout() {},

    minZoomIndicatorEnabled: true,
    minZoomIndicatorOptions: {
      minZoomMessageNoLayer: 'No layer assigned',
      minZoomMessage:
        'Current zoom Level: CURRENTZOOM. Data are visible at Level: MINZOOMLEVEL.',
    },
  },

  async _initDB() {
    this._db = await openDB(md5(this.options.query), 1, {
      upgrade(db) {
        db.createObjectStore('cache', { autoIncrement: true });
      },
    });

    let items = await this._db.getAll('cache');
    let keys = await this._db.getAllKeys('cache');

    items.forEach((item: any, i: any) => {
      if (new Date() > item.expires) {
        this._db.delete('cache', keys[i]);
      } else {
        this.options.onSuccess.call(this, item.result);
        this._onRequestLoadCallback(item.bounds);
      }
    });

    if (!this.options.noInitialRequest) {
      this._prepareRequest();
    }
  },

  initialize: function (options: OverPassLayerOptions) {
    L.Util.setOptions(this, options);

    this._ids = {};

    // Random endpoint
    if (this.options.endPoints)
      this._endPointsIndex = Math.floor(
        Math.random() * this.options.endPoints.length
      );
    this._loadedBounds = options.loadedBounds || [];

    if (this.options.cacheEnabled) {
      this._initDB();
    }
  },

  _getPoiPopupHTML(tags: OverPass.Tags, id: number) {
    let row;
    const link = document.createElement('a');
    const table = document.createElement('table');
    const div = document.createElement('div');

    link.href = `https://www.openstreetmap.org/edit?editor=id&node=${id}`;
    link.appendChild(document.createTextNode('Edit this entry in iD'));

    table.style.borderSpacing = '10px';
    table.style.borderCollapse = 'separate';

    for (const key in tags) {
      row = table.insertRow(0);
      row.insertCell(0).appendChild(document.createTextNode(key));
      row.insertCell(1).appendChild(document.createTextNode(tags[key] + ''));
    }

    div.appendChild(link);
    div.appendChild(table);

    return div;
  },

  _buildRequestBox(bounds: L.LatLngBounds) {
    return L.rectangle(bounds, {
      bounds: bounds,
      color: '#204a87',
      stroke: false,
      fillOpacity: 0.1,
      clickable: false,
    } as any);
  },

  _addRequestBox(box: L.Rectangle) {
    return this._requestBoxes?.addLayer(box);
  },

  _getRequestBoxes() {
    return this._requestBoxes?.getLayers();
  },

  _removeRequestBox(box: any) {
    this._requestBoxes?.removeLayer(box);
  },

  _removeRequestBoxes() {
    return this._requestBoxes?.clearLayers();
  },

  _addResponseBox(box: any) {
    return this._responseBoxes.addLayer(box);
  },

  _addResponseBoxes(requestBoxes: L.Layer[]) {
    this._removeRequestBoxes();

    requestBoxes.forEach((box: any) => {
      box.setStyle({
        color: 'black',
        weight: 2,
      });
      this._addResponseBox(box);
    });
  },

  _isFullyLoadedBounds(bounds: any, loadedBounds: any[]) {
    if (loadedBounds.length === 0) {
      return false;
    }

    const subjectClips = this._buildClipsFromBounds([bounds]);
    const knownClips = this._buildClipsFromBounds(loadedBounds);
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

    const solutionExPolygons =
      ClipperLib.JS.PolyTreeToExPolygons(solutionPolyTree);

    if (solutionExPolygons.length === 0) {
      return true;
    } else {
      return false;
    }
  },

  _getLoadedBounds() {
    return this._loadedBounds;
  },

  _addLoadedBounds(bounds: any) {
    this._loadedBounds.push(bounds);
  },

  _buildClipsFromBounds(bounds: any[]) {
    return bounds.map((bound: any) => [
      {
        X: bound._southWest.lng * 1000000,
        Y: bound._southWest.lat * 1000000,
      },
      {
        X: bound._southWest.lng * 1000000,
        Y: bound._northEast.lat * 1000000,
      },
      {
        X: bound._northEast.lng * 1000000,
        Y: bound._northEast.lat * 1000000,
      },
      {
        X: bound._northEast.lng * 1000000,
        Y: bound._southWest.lat * 1000000,
      },
    ]);
  },

  _buildBoundsFromClips(clips: any) {
    return clips.map((clip: any) =>
      L.latLngBounds(
        L.latLng(clip[0].Y / 1000000, clip[0].X / 1000000).wrap(),
        L.latLng(clip[2].Y / 1000000, clip[2].X / 1000000).wrap()
      )
    );
  },

  _buildOverpassUrlFromEndPointAndQuery(
    endPoint: {
      url: string;
      extendQuerySupport: boolean;
      bounds?: [number, number, number, number];
    },
    query: string,
    bounds: any
  ) {
    const sw = bounds._southWest;
    const ne = bounds._northEast;
    const coordinates = [sw.lat, sw.lng, ne.lat, ne.lng].join(',');

    if (!endPoint.extendQuerySupport) {
      query = query.replace(
        /([(;/\s])nw((\[.*])*(\(.*\))*;)/gim,
        '$1node$2way$2'
      );
      query = query.replace(
        /([(;/\s])nr((\[.*])*(\(.*\))*;)/gim,
        '$1node$2relation$2'
      );
      query = query.replace(
        /([(;/\s])wr((\[.*])*(\(.*\))*;)/gim,
        '$1way$2relation$2'
      );
    }

    query = query.replace(/(\/\/.*)/g, '');

    return `${endPoint.url}interpreter?data=[out:json][timeout:${this.options.timeout}][bbox:${coordinates}];${query}`;
  },

  _buildLargerBounds(bounds: any) {
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

  _setRequestInProgress(isInProgress: any) {
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

  _setNextRequest(nextRequest: any) {
    this._nextRequest = nextRequest;
  },

  _removeNextRequest() {
    this._nextRequest = null;
  },

  _prepareRequest() {
    if (!this._map) {
      return;
    }

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

    return undefined;
  },

  _retry(bounds: L.LatLngBounds) {
    this._nextEndPoint(bounds);
    this._sendRequest(bounds);
  },

  _nextEndPoint(requestBounds: L.LatLngBounds) {
    if (this._endPointsIndex < this.options.endPoints.length - 1) {
      this._endPointsIndex++;
    } else {
      this._endPointsIndex = 0;
    }

    if (this._endPointSupportsBounds(requestBounds))
      this._nextEndPoint(requestBounds);
  },

  _sendRequest(bounds: L.LatLngBounds) {
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

    request.open('GET', url, true);
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

  _endPointSupportsBounds(bounds: any) {
    const supportedBounds = this.options.endPoints[this._endPointsIndex].bounds;
    return (
      supportedBounds &&
      !L.latLngBounds([
        [supportedBounds[0], supportedBounds[1]],
        [supportedBounds[2], supportedBounds[3]],
      ]).contains(bounds)
    );
  },

  _onRequestLoad(xhr: any, bounds: any) {
    if (xhr.status >= 200 && xhr.status < 400) {
      let result = JSON.parse(xhr.response);
      this.options.onSuccess.call(this, result);

      if (this.options.cacheEnabled) {
        let expireDate = new Date();
        expireDate.setSeconds(expireDate.getSeconds() + this.options.cacheTTL);

        this._db.put('cache', {
          result: result,
          bounds: bounds,
          expires: expireDate,
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

  _onRequestTimeout(xhr: any, _url: any, bounds: any) {
    this.options.onTimeout.call(this, xhr);

    if (this.options.retryOnTimeout) {
      this._retry(bounds);
    } else {
      this._onRequestErrorCallback(bounds);
      this._onRequestCompleteCallback(bounds);
    }
  },

  _onRequestLoadCallback(bounds: any) {
    this._addLoadedBounds(bounds);

    if (this.options.debug) {
      this._addResponseBoxes(this._getRequestBoxes());
    }
  },

  _onRequestErrorCallback(bounds: any) {
    if (this.options.debug) {
      this._removeRequestBox(this._buildRequestBox(bounds));
    }
  },

  _onRequestCompleteCallback(_bounds: any) {
    this.options.afterRequest.call(this);

    if (this._hasNextRequest()) {
      const nextRequest = this._getNextRequest();

      this._removeNextRequest();

      nextRequest();
    } else {
      this._setRequestInProgress(false);
    }
  },

  onAdd(map: MapWithZoomIndicator) {
    this._map = map;

    if (this.options.minZoomIndicatorEnabled === true) {
      if (this._map.zoomIndicator) {
        this._zoomControl = this._map.zoomIndicator;
        this._zoomControl._addLayer(this);
      } else {
        this._zoomControl = new MinZoomIndicator(
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

    this._map.on('moveend', this._prepareRequest, this);
  },

  onRemove(map: L.Map) {
    L.LayerGroup.prototype.onRemove.call(this, map);

    this._resetData();

    map.off('moveend', this._prepareRequest, this);

    this._map = null;
  },

  setQuery(query: string) {
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

    if (this._markers) this._markers.clearLayers();
    else throw 'Unexpected undefined: this._markers';

    if (this.options.debug) {
      this._requestBoxes?.clearLayers();
      this._responseBoxes?.clearLayers();
    }
  },

  getData() {
    return this._data;
  },
} as L.IOverPassLayer) as any as new (
  options: OverPassLayerOptions
) => L.IOverPassLayer & L.FeatureGroup;

declare module 'leaflet' {
  export interface IOverPassLayer {
    _markers?: L.FeatureGroup<any>;
    _db: any;
    _loadedBounds: any[];
    _requestInProgress: boolean;
    _responseBoxes: any;
    _nextRequest: any;
    _map?: MapWithZoomIndicator | null;
    _zoomControl: any;
    _data: any;
    _requestBoxes?: L.FeatureGroup<any>;
    _initDB(): Promise<void>;
    _ids: { [id: number]: boolean };
    initialize(options: OverPassLayerOptions): void;
    _getPoiPopupHTML(tags: OverPass.Tags, id: number): HTMLDivElement;
    _buildRequestBox(bounds: any): L.Rectangle;
    _addRequestBox(box: L.Rectangle): L.FeatureGroup<any>;
    _getRequestBoxes(): L.Layer[];
    _removeRequestBox(box: any): void;
    _removeRequestBoxes(): L.FeatureGroup<any>;
    _addResponseBox(box: any): any;
    _addResponseBoxes(requestBoxes: L.Layer[]): void;
    _isFullyLoadedBounds(bounds: any, loadedBounds: any[]): boolean;
    _getLoadedBounds(): any[];
    _addLoadedBounds(bounds: any): void;
    _buildClipsFromBounds(bounds: any[]): any;
    _buildBoundsFromClips(clips: any): any;
    _buildOverpassUrlFromEndPointAndQuery(
      endPoint: {
        url: string;
        extendQuerySupport: boolean;
        bounds?: [number, number, number, number];
      },
      query: string,
      bounds: any
    ): string;
    _buildLargerBounds(bounds: L.LatLngBounds): L.LatLngBounds;
    _setRequestInProgress(isInProgress: any): void;
    _isRequestInProgress(): any;
    _hasNextRequest(): boolean;
    _getNextRequest(): any;
    _setNextRequest(nextRequest: any): void;
    _removeNextRequest(): void;
    _prepareRequest(): false | undefined;
    _retry(bounds: L.LatLngBounds): void;
    _nextEndPoint(requestBounds: L.LatLngBounds): void;
    _sendRequest(bounds: L.LatLngBounds): void;
    _endPointsIndex: number;
    _endPointSupportsBounds(bounds: any): boolean | undefined;
    _onRequestLoad(xhr: any, bounds: any): void;
    _onRequestTimeout(xhr: any, url: any, bounds: any): void;
    _onRequestLoadCallback(bounds: any): void;
    _onRequestErrorCallback(bounds: any): void;
    _onRequestCompleteCallback(bounds: any): void;
    options: Required<OverPassLayerOptions>;
    onAdd(map: L.Map): void;
    onRemove(map: L.Map): void;
    setQuery(query: string): void;
    _resetData(): void;
    getData(): any;
  }

  type OverPassLayer = typeof overPassLayer;
}

export type OverPassLayerOptions = {
  debug?: boolean;
  minZoom?: number;
  endPoints?: {
    url: string;
    extendQuerySupport: boolean;
    bounds?: [number, number, number, number];
  }[];
  query?: string;
  loadedBounds?: any[];
  markerIcon?: L.Icon | L.DivIcon | null;
  timeout?: number;
  retryOnTimeout?: boolean;
  noInitialRequest?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  beforeRequest?(): void;
  afterRequest?(): void;
  onSuccess?(data: OverPass.RootObject): void;
  onError?(): void;
  onTimeout?(): void;
  minZoomIndicatorEnabled?: boolean;
  minZoomIndicatorOptions?: MinZoomIndicatorOptions;
};

(L as any).OverPassLayer = overPassLayer;
