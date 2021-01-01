import 'array-flat-polyfill';
import { Language } from "./Language";
/**
 * A stop which consists of its ID and name
 */
declare type Stop = InstanceType<Kmb['Stop']>;
/**
 * A route which consists of its route number (e.g. 104) and its bound (1 for forward, 2 for backward)
 */
declare type Route = InstanceType<Kmb['Route']>;
/**
 * A variant, identified by the route and the variant number (service type)
 */
declare type Variant = InstanceType<Kmb['Variant']>;
/**
 * An instance which a variant stops at a bus stop
 */
declare type Stopping = InstanceType<Kmb['Stopping']>;
/**
 * An ETA entry
 */
declare type Eta = InstanceType<Kmb['Eta']>;
/**
 * main KMB API class
 */
export default class Kmb {
    readonly language: Language;
    corsProxyUrl: string | null;
    readonly Stop: {
        new (id: string, name?: string | undefined, name_zh?: string | undefined, name_en?: string | undefined): {
            readonly id: string;
            /**
             * The "street" part of the ID, e.g. "AB01"
             */
            readonly streetId: string;
            /**
             * The "direction" part of the ID, normally N, E, S, W for directions, K, C for circular road or T for terminus
             */
            readonly streetDirection: string;
            /**
             * The name of the stop, undefined if it isn't in the cache
             */
            readonly name: string | undefined;
            /**
             * The zh name of the stop, undefined if it isn't in the cache
             */
            readonly nameZh: string | undefined;
            /**
             * The en name of the stop, undefined if it isn't in the cache
             */
            readonly nameEn: string | undefined;
            /**
             * Get the list of route variants serving a particular stop
             * @param all_variants Specify to be true to list all variants for the same route and direction, false for only the main one
             * @param update_count An optional callback to update the progress of how many routes are remaining
             */
            getStoppings(all_variants?: boolean, update_count?: ((remaining: number) => void) | undefined): Promise<Stopping[]>;
        };
    };
    readonly Route: {
        new (number: string, bound: number): {
            readonly number: string;
            readonly bound: number;
            /**
             * @returns a string in forms of "Route-Bound" which can be used as an identifier, e.g. "58X-2"
             */
            getRouteBound(): string;
            getVariants(): Promise<Variant[]>;
        };
        /**
         * Compares the routes according to human's expectation
         *
         * The routes are sorted according to its letter prefix, the number part sorted naturally, and the letter suffix.
         * If the route numbers are the same, the bounds are compared
         *
         * @param a
         * @param b
         */
        compare(a: Route, b: Route): -1 | 0 | 1;
    };
    readonly Variant: {
        new (route: Route, serviceType: number, origin: string, originZh: string, originEn: string, destination: string, destinationZh: string, destinationEn: string, description: string, descriptionZh: string, descriptionEn: string): {
            readonly route: Route;
            readonly serviceType: number;
            readonly origin: string;
            readonly originZh: string;
            readonly originEn: string;
            readonly destination: string;
            readonly destinationZh: string;
            readonly destinationEn: string;
            readonly description: string;
            readonly descriptionZh: string;
            readonly descriptionEn: string;
            /**
             * @returns a string in form of "origin → destination"
             */
            getOriginDestinationString(): string;
            getStoppings(): Promise<Stopping[]>;
        };
    };
    readonly Stopping: {
        new (stop: Stop, variant: Variant, direction: string, sequence: number, fare: number): {
            readonly stop: Stop;
            readonly variant: Variant;
            readonly direction: string;
            readonly sequence: number;
            readonly fare: number;
            callMobileEtaApi(method?: 'GET' | 'POST'): Promise<{
                t: string;
                eot: string;
                dis?: number | undefined;
            }[]>;
            callWebEtaApi(): Promise<{
                t: string;
                eot: string;
                dis?: number | undefined;
            }[]>;
            getEtas(retry_count?: number, fetcher?: () => Promise<{
                t: string;
                eot: string;
                dis?: number | undefined;
            }[]>): Promise<Eta[]>;
        };
    };
    readonly Eta: {
        new (stopping: Stopping, time: Date, distance: number | undefined, remark: string, realTime: boolean): {
            readonly stopping: Stopping;
            readonly time: Date;
            readonly distance: number | undefined;
            readonly remark: string;
            readonly realTime: boolean;
        };
        /**
         * Compare two ETA entries by time
         */
        compare(a: Eta, b: Eta): number;
    };
    private readonly apiEndpoint;
    static readonly STORAGE_VERSION_KEY = "$version";
    private static readonly stopStorageVersion;
    private static readonly stoppingStorageVersion;
    /**
     * Construct an API instance
     * @param language
     * @param stopStorage The cache used for storing stop names (suggest localStorage in browser). If not specified an in-memory store is used.
     * @param stoppingStorage The cache used for storing stoppings (suggest sessionStorage in browser)
     * @param corsProxyUrl If specified all ETA requests will go through the CORS proxy. Required to get ETAs in browser.
     *
     * @example
     * // construct an English API in Node.js
     * const api = new Kmb();
     * @example
     * // construct a simplified Chinese API in the browser
     * const api = new Kmb('zh-hans', localStorage, sessionStorage, 'https://cors-anywhere.herokuapp.com/')
     */
    constructor(language?: Language, stopStorage?: Storage, stoppingStorage?: Storage, corsProxyUrl?: string | null);
    /**
     * Get the routes of that route number
     *
     * @return 2 routes for bi-direction non-circular routes, 1 route for single-direction or circular routes, 0 for not found
     */
    getRoutes(route_number: string): Promise<Route[]>;
    /**
     * Call the FunctionRequest.ashx API on the search.kmb.hk website
     * @param query
     */
    callApi(query: Record<string, string>): Promise<unknown>;
    static toTitleCase(string: string): string;
    static convertHkscs: (str: string) => string;
}
export { Language, Stop, Route, Variant, Stopping, Eta };
//# sourceMappingURL=index.d.ts.map