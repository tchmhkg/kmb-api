"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const https = require("https");
const StorageShim = require("node-storage-shim");
require("array-flat-polyfill");
const axios_1 = require("axios");
const hkscsConverter = require("hkscs_converter");
const Secret_1 = require("./Secret");
/**
 * main KMB API class
 */
class Kmb {
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
    constructor(language = 'en', stopStorage = new StorageShim(), stoppingStorage, corsProxyUrl = null) {
        this.language = language;
        this.corsProxyUrl = corsProxyUrl;
        this.apiEndpoint = 'https://search.kmb.hk/KMBWebSite/Function/FunctionRequest.ashx';
        for (const { storage, version } of [
            { storage: stopStorage, version: Kmb.stopStorageVersion },
            { storage: stoppingStorage, version: Kmb.stoppingStorageVersion },
        ]) {
            if (storage !== undefined && Number(storage[Kmb.STORAGE_VERSION_KEY]) !== version) {
                storage.clear();
                storage[Kmb.STORAGE_VERSION_KEY] = version;
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const kmb = this;
        this.Stop = class {
            constructor(id, name, name_zh, name_en) {
                this.id = id;
                if (stopStorage !== undefined && name !== undefined) {
                    stopStorage[`${id}_${kmb.language}`] = name;
                    stopStorage[`${id}_zh-hant`] = name_zh;
                    stopStorage[`${id}_en`] = name_en;
                }
            }
            /**
             * The "street" part of the ID, e.g. "AB01"
             */
            get streetId() {
                return this.id.split('-')[0];
            }
            /**
             * The "direction" part of the ID, normally N, E, S, W for directions, K, C for circular road or T for terminus
             */
            get streetDirection() {
                return this.id.split('-')[1];
            }
            /**
             * The name of the stop, undefined if it isn't in the cache
             */
            get name() {
                var _a;
                return stopStorage === undefined ? undefined : (_a = stopStorage.getItem(`${this.id}_${kmb.language}`)) !== null && _a !== void 0 ? _a : undefined;
            }
            /**
             * The zh name of the stop, undefined if it isn't in the cache
             */
            get nameZh() {
                var _a;
                return stopStorage === undefined ? undefined : (_a = stopStorage.getItem(`${this.id}_zh-hant`)) !== null && _a !== void 0 ? _a : undefined;
            }
            /**
             * The en name of the stop, undefined if it isn't in the cache
             */
            get nameEn() {
                var _a;
                return stopStorage === undefined ? undefined : (_a = stopStorage.getItem(`${this.id}_en`)) !== null && _a !== void 0 ? _a : undefined;
            }
            /**
             * Get the list of route variants serving a particular stop
             * @param all_variants Specify to be true to list all variants for the same route and direction, false for only the main one
             * @param update_count An optional callback to update the progress of how many routes are remaining
             */
            getStoppings(all_variants = false, update_count) {
                var _a;
                return __awaiter(this, void 0, void 0, function* () {
                    const initial_name = this.name;
                    const cached = (_a = stoppingStorage === null || stoppingStorage === void 0 ? void 0 : stoppingStorage.getItem(`${this.id}_${kmb.language}`)) !== null && _a !== void 0 ? _a : null;
                    const get_main_service_type = (variants, route) => Math.min(...variants.filter(a => a.route.getRouteBound() === route.getRouteBound())
                        .map(a => a.serviceType));
                    const filter_stop_routes = all_variants
                        ? () => true
                        : (value, index, array) => value.variant.serviceType === get_main_service_type(array.map(a => a.variant), value.variant.route);
                    if (cached !== null) {
                        const result = JSON.parse(cached);
                        return result.map(item => {
                            const name = new kmb.Stop(item.stop.id).name;
                            const nameZh = new kmb.Stop(item.stop.id).nameZh;
                            const nameEn = new kmb.Stop(item.stop.id).nameEn;
                            if (name === undefined) {
                                throw new Error('Attempting to load StopRoute cache but stop name can\'t be found');
                            }
                            return new kmb.Stopping(new kmb.Stop(item.stop.id, name, nameZh, nameEn), new kmb.Variant(new kmb.Route(item.variant.route.number, item.variant.route.bound), item.variant.serviceType, item.variant.origin, item.variant.originZh, item.variant.originEn, item.variant.destination, item.variant.destinationZh, item.variant.destinationEn, item.variant.description, item.variant.descriptionZh, item.variant.descriptionEn), item.direction, item.sequence, item.fare);
                        }).filter(filter_stop_routes);
                    }
                    else {
                        const json = yield kmb.callApi({
                            action: 'getRoutesInStop',
                            bsiCode: this.id
                        });
                        let remaining_routes = json.data.length;
                        if (update_count !== undefined) {
                            update_count(remaining_routes);
                        }
                        const results = (yield Promise.all(json.data.map((item) => __awaiter(this, void 0, void 0, function* () {
                            const route_number = item.trim();
                            // loop through each route and bound
                            // let remaining_bounds = data.length;
                            const results = (yield Promise.all((yield kmb.getRoutes(route_number)).map((route) => __awaiter(this, void 0, void 0, function* () {
                                return (yield Promise.all((yield route.getVariants()).map((variant) => __awaiter(this, void 0, void 0, function* () {
                                    return (yield variant.getStoppings()).filter(({ stop: inner_stop }) => inner_stop.id === this.id
                                        || initial_name !== undefined
                                            // some poles in the same bus terminus are missing words "Bus Terminus"
                                            && (inner_stop.streetDirection === 'T' || inner_stop.name === initial_name)
                                            && inner_stop.streetId === this.streetId
                                            && inner_stop.streetDirection === this.streetDirection);
                                })))).flat();
                            })))).flat();
                            --remaining_routes;
                            if (update_count !== undefined) {
                                update_count(remaining_routes);
                            }
                            return results;
                        })))).flat();
                        console.log('results =>', results);
                        if (initial_name === undefined) {
                            // when initial name is undefined the result may be incomplete
                            return results[0].stop.getStoppings(all_variants, update_count);
                        }
                        else {
                            stoppingStorage === null || stoppingStorage === void 0 ? void 0 : stoppingStorage.setItem(`${this.id}_${kmb.language}`, JSON.stringify(results));
                            return results.filter(filter_stop_routes);
                        }
                    }
                });
            }
        };
        this.Route = class {
            /**
             * @param number The route number, e.g. 104
             * @param bound The bound, normally 1 for forward, 2 for backward
             */
            constructor(number, bound) {
                this.number = number;
                this.bound = bound;
            }
            /**
             * @returns a string in forms of "Route-Bound" which can be used as an identifier, e.g. "58X-2"
             */
            getRouteBound() {
                return `${this.number}-${this.bound}`;
            }
            /**
             * Compares the routes according to human's expectation
             *
             * The routes are sorted according to its letter prefix, the number part sorted naturally, and the letter suffix.
             * If the route numbers are the same, the bounds are compared
             *
             * @param a
             * @param b
             */
            static compare(a, b) {
                const compare_route_number = (a, b) => {
                    const explode_segments = (route_id) => {
                        const segments = [];
                        [...route_id].forEach(character => {
                            function is_number(x) {
                                return x >= '0' && x <= '9';
                            }
                            if (segments.length === 0
                                || is_number(segments[segments.length - 1]
                                    .charAt(segments[segments.length - 1].length - 1)) !== is_number(character)) {
                                segments.push(character);
                            }
                            else {
                                segments[segments.length - 1] += character;
                            }
                        });
                        return segments;
                    };
                    const a_segments = explode_segments(a);
                    const b_segments = explode_segments(b);
                    let i = 0;
                    while (i < a_segments.length && i < b_segments.length) {
                        const is_a_number = !isNaN(Number(a_segments[i]));
                        const is_b_number = !isNaN(Number(b_segments[i]));
                        if (is_a_number === is_b_number) {
                            if (is_a_number) {
                                a_segments[i] = Number(a_segments[i]);
                                b_segments[i] = Number(b_segments[i]);
                            }
                            if (a_segments[i] < b_segments[i]) {
                                return -1;
                            }
                            else {
                                if (b_segments[i] < a_segments[i]) {
                                    return 1;
                                }
                            }
                        }
                        else {
                            return is_a_number > is_b_number ? -1 : 1;
                        }
                        ++i;
                    }
                    return i >= a_segments.length ? i >= b_segments.length ? 0 : -1 : 1;
                };
                return a.number === b.number
                    ? a.bound > b.bound ? 1 : a.bound < b.bound ? -1 : 0
                    : compare_route_number(a.number, b.number);
            }
            getVariants() {
                return __awaiter(this, void 0, void 0, function* () {
                    const json = yield kmb.callApi({
                        action: 'getSpecialRoute',
                        route: this.number,
                        bound: String(this.bound),
                    });
                    return json.data.routes.map(item => new kmb.Variant(this, Number(item.ServiceType), Kmb.toTitleCase(Kmb.convertHkscs(item[{
                        'en': 'Origin_ENG',
                        'zh-hans': 'Origin_CHI',
                        'zh-hant': 'Origin_CHI'
                    }[kmb.language]])), Kmb.toTitleCase(Kmb.convertHkscs(item['Origin_CHI'])), Kmb.toTitleCase(Kmb.convertHkscs(item['Origin_ENG'])), Kmb.toTitleCase(Kmb.convertHkscs(item[{
                        'en': 'Destination_ENG',
                        'zh-hans': 'Destination_CHI',
                        'zh-hant': 'Destination_CHI'
                    }[kmb.language]])), Kmb.toTitleCase(Kmb.convertHkscs(item['Destination_CHI'])), Kmb.toTitleCase(Kmb.convertHkscs(item['Destination_ENG'])), Kmb.convertHkscs(item[{
                        'en': 'Desc_ENG',
                        'zh-hans': 'Desc_CHI',
                        'zh-hant': 'Desc_CHI'
                    }[kmb.language]]), Kmb.convertHkscs(item['Desc_CHI']), Kmb.convertHkscs(item['Desc_ENG'])));
                });
            }
        };
        this.Variant = class {
            /**
             * Create a route variant
             *
             * @param route The route which the variant belongs to
             * @param serviceType A number identifying the particular variant
             * @param origin
             * @param destination
             * @param description The description of the variant, e.g. "Normal routeing"
             */
            constructor(route, serviceType, origin, originZh, originEn, destination, destinationZh, destinationEn, description, descriptionZh, descriptionEn) {
                this.route = route;
                this.serviceType = serviceType;
                this.origin = origin;
                this.originZh = originZh;
                this.originEn = originEn;
                this.destination = destination;
                this.destinationZh = destinationZh;
                this.destinationEn = destinationEn;
                this.description = description;
                this.descriptionZh = descriptionZh;
                this.descriptionEn = descriptionEn;
            }
            /**
             * @returns a string in form of "origin → destination"
             */
            getOriginDestinationString() {
                return `${this.origin} → ${this.destination}`;
            }
            getStoppings() {
                return __awaiter(this, void 0, void 0, function* () {
                    const json = yield kmb.callApi({
                        action: 'getstops',
                        route: this.route.number,
                        bound: String(this.route.bound),
                        serviceType: String(this.serviceType)
                    });
                    return json.data.routeStops.map(item => new kmb.Stopping(new kmb.Stop(item.BSICode, Kmb.toTitleCase(Kmb.convertHkscs(item[{
                        'en': 'EName',
                        'zh-hans': 'SCName',
                        'zh-hant': 'CName'
                    }[kmb.language]])), Kmb.toTitleCase(Kmb.convertHkscs(item['CName'])), Kmb.toTitleCase(Kmb.convertHkscs(item['EName']))), this, item.Direction.trim(), Number(item.Seq), Number(item.AirFare)));
                });
            }
        };
        this.Stopping = class {
            /**
             * @param stop
             * @param variant
             * @param direction A string specifying whether the stop is in forward (F) or backward (B) direction of the route
             * @param sequence The order of the stopping in the variant
             * @param fare
             */
            constructor(stop, variant, direction, sequence, fare) {
                this.stop = stop;
                this.variant = variant;
                this.direction = direction;
                this.sequence = sequence;
                this.fare = fare;
            }
            callMobileEtaApi(method = 'GET') {
                var _a, _b;
                const secret = Secret_1.default.getSecret(`${new Date().toISOString().split('.')[0]}Z`);
                const languages = { 'en': 'en', 'zh-hans': 'sc', 'zh-hant': 'tc' };
                const query = {
                    lang: languages[kmb.language],
                    route: this.variant.route.number,
                    bound: String(this.variant.route.bound),
                    stop_seq: String(this.sequence),
                    service_type: String(this.variant.serviceType),
                    vendor_id: Secret_1.default.VENDOR_ID,
                    apiKey: secret.apiKey,
                    ctr: String(secret.ctr)
                };
                const encrypted_query = Secret_1.default.getSecret(`?${new URLSearchParams(query).toString()}`, secret.ctr);
                const promise = method === 'POST'
                    ? axios_1.default.post(`${(_a = kmb.corsProxyUrl) !== null && _a !== void 0 ? _a : ''}https://etav3.kmb.hk/?action=geteta`, {
                        d: encrypted_query.apiKey,
                        ctr: encrypted_query.ctr
                    }, { responseType: 'json', httpsAgent: new https.Agent({
                            rejectUnauthorized: false
                        }) })
                    : axios_1.default.get(`${(_b = kmb.corsProxyUrl) !== null && _b !== void 0 ? _b : ''}https://etav3.kmb.hk/?action=geteta`, { params: query, responseType: 'json', httpsAgent: new https.Agent({
                            rejectUnauthorized: false
                        }) });
                return promise.then(({ data: json }) => {
                    var _a;
                    if (json[0] === undefined) {
                        throw new Error("Response does not contain ETA data");
                    }
                    return (_a = json[0]) === null || _a === void 0 ? void 0 : _a.eta;
                });
            }
            callWebEtaApi() {
                const current_date = new Date;
                const date_string = `${current_date.getUTCFullYear()}-${(`00${current_date.getUTCMonth() + 1}`).slice(-2)}-${(`00${current_date.getUTCDate()}`).slice(-2)} ${(`00${current_date.getUTCHours()}`).slice(-2)}:${(`00${current_date.getUTCMinutes()}`).slice(-2)}:${(`00${current_date.getUTCSeconds()}`).slice(-2)}.${(`00${current_date.getUTCMilliseconds()}`).slice(-2)}.`;
                const sep = `--31${date_string}13--`;
                const token = `E${Secret_1.default.btoa(this.variant.route.number
                    + sep
                    + String(this.variant.route.bound)
                    + sep
                    + String(this.variant.serviceType)
                    + sep
                    + this.stop.id.trim().replace(/-/gi, '')
                    + sep
                    + String(this.sequence)
                    + sep
                    + String((new Date).getTime()))}`;
                return axios_1.default.post(`${(corsProxyUrl !== null && corsProxyUrl !== void 0 ? corsProxyUrl : '') + kmb.apiEndpoint}?action=get_ETA&lang=${{ 'en': 0, 'zh-hant': 1, 'zh-hans': 2 }[language]}`, new URLSearchParams({
                    token,
                    t: date_string,
                }).toString(), { responseType: 'json', httpsAgent: new https.Agent({
                        rejectUnauthorized: false
                    }), headers: { Origin: 'https://search.kmb.hk' } }).then(({ data: json }) => {
                    if (json.data.response === undefined) {
                        throw new Error("Response does not contain ETA data");
                    }
                    return json.data.response;
                });
            }
            getEtas(retry_count = 5, fetcher = this.callMobileEtaApi.bind(this)) {
                return __awaiter(this, void 0, void 0, function* () {
                    const promise = fetcher.call(this);
                    return promise.then((response) => response
                        .map(obj => ({
                        time: obj.t.substr(0, 5),
                        remark: obj.t.substr(6),
                        real_time: typeof obj.dis === 'number',
                        distance: obj.dis,
                    }))
                        .filter(obj => /^[0-9][0-9]:[0-9][0-9]$/.test(obj.time))
                        .map(obj => {
                        const time = new Date();
                        time.setUTCHours((Number(obj.time.split(':')[0]) + 24 - 8) % 24, Number(obj.time.split(':')[1]), 0);
                        if (time.getTime() - Date.now() < -60 * 60 * 1000 * 2) {
                            // the time is less than 2 hours past - assume midnight rollover
                            time.setDate(time.getDate() + 1);
                        }
                        if (time.getTime() - Date.now() > 60 * 60 * 1000 * 6) {
                            // the time is more than 6 hours in the future - assume midnight rollover
                            time.setDate(time.getDate() - 1);
                        }
                        return new kmb.Eta(this, time, obj.distance, Kmb.convertHkscs(obj.remark), obj.real_time);
                    }), reason => {
                        if (retry_count > 0) {
                            return this.getEtas(retry_count - 1, fetcher);
                        }
                        else {
                            throw reason;
                        }
                    });
                });
            }
        };
        this.Eta = class {
            /**
             * Create an ETA entry
             *
             * @param stopping The stop-route where the ETA was queried
             * @param time The ETA time
             * @param distance The distance (in metres) of the bus from the stop
             * @param remark The remark of the ETA (e.g. KMB/NWFB, Scheduled)
             * @param realTime If the ETA is real-time
             */
            constructor(stopping, time, distance, remark, realTime) {
                this.stopping = stopping;
                this.time = time;
                this.distance = distance;
                this.remark = remark;
                this.realTime = realTime;
            }
            /**
             * Compare two ETA entries by time
             */
            static compare(a, b) {
                return a.time.getTime() - b.time.getTime();
            }
        };
    }
    /**
     * Get the routes of that route number
     *
     * @return 2 routes for bi-direction non-circular routes, 1 route for single-direction or circular routes, 0 for not found
     */
    getRoutes(route_number) {
        return __awaiter(this, void 0, void 0, function* () {
            const json = yield this.callApi({
                action: 'getroutebound',
                route: route_number
            });
            return json.data.map(({ BOUND }) => BOUND)
                .filter((value, index, array) => array.indexOf(value) === index)
                .map(bound => new this.Route(route_number, bound));
        });
    }
    /**
     * Call the FunctionRequest.ashx API on the search.kmb.hk website
     * @param query
     */
    callApi(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield axios_1.default.get(this.apiEndpoint, { params: query, responseType: 'json' })).data;
        });
    }
    static toTitleCase(string) {
        return string.toLowerCase().replace(/((^|[^a-z0-9'])+)(.)/g, (match, p1, p2, p3) => p1 + p3.toUpperCase());
    }
}
exports.default = Kmb;
// change the below when the storage used is no longer compatible with the old version
Kmb.STORAGE_VERSION_KEY = '$version';
Kmb.stopStorageVersion = 3;
Kmb.stoppingStorageVersion = 3;
Kmb.convertHkscs = hkscsConverter.convertString;
//# sourceMappingURL=index.js.map