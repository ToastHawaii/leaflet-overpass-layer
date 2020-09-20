import "leaflet";

declare module "leaflet" {
  type OverPassLayerOptions = {
    debug: boolean;
    minZoom: number;
    endPoints: (
      | {
          url: string;
          extendQuerySupport: boolean;
          bounds?: undefined;
        }
      | {
          url: string;
          extendQuerySupport: boolean;
          bounds: number[];
        }
    )[];
    query: string;
    loadedBounds: number[];
    markerIcon: null;
    timeout: number;
    retryOnTimeout: boolean;
    noInitialRequest: boolean;
    cacheEnabled: boolean;
    cacheTTL: number;
    beforeRequest(): void;
    afterRequest(): void;
    onSuccess(data: OverPass.RootObject[]): void;
    onError(): void;
    onTimeout(): void;
    minZoomIndicatorEnabled: boolean;
    minZoomIndicatorOptions: {
      minZoomMessageNoLayer: string;
      minZoomMessage: string;
    };
  };

  export class OverPassLayer extends FeatureGroup {
    constructor(options: OverPassLayerOptions);
    setQuery(query: string): void;
    getData(): any;
  }
  export var overPassLayer: OverPassLayer;
  namespace Control {
    type MinZoomIndicatorOptions = {
      minZoom: number;
      minZoomMessageNoLayer: string;
      minZoomMessage: string;
    } & ControlOptions;
    export class MinZoomIndicator extends Control {
      constructor(options: MinZoomIndicatorOptions);
      options: MinZoomIndicatorOptions;
      onAdd(map: Map): HTMLElement;
      onRemove(map: Map): void;
    }
  }
}
