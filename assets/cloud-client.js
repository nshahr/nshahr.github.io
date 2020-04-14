class Utils {
    static _caseInsensitiveEquals(name1, name2) {
        return name1.trim().toLowerCase() === name2.trim().toLowerCase();
    }

    /**
     * Tries to convert value to the best string representation
     * Convert is not 100% complete yet, just tries to cover most common cases
     */
    static _convertToString(value) {
        if (typeof value === "string" || value instanceof String) {
            return value;
        } else if (typeof value === "number" || typeof value === "boolean") {
            return value.toString();
        } else if (value instanceof Date) {
            let dateTimeString = value.toISOString();
            return dateTimeString.slice(0, dateTimeString.lastIndexOf('.'));
        }
        return JSON.stringify(value);
    }

    /**
     * Tries to convert value to the type
     * Convert is not 100% complete yet, just tries to cover most common cases
     */
    static _convertFromString(value, type) {
        if (type === "STRING") {
            return value;
        } else if (type === "DATE_TIME") {
            return new Date(value);
        }
        return JSON.parse(value);
    }
}

class FullScreenUtils {
    static isFullScreenEnabled() {
        return document.fullscreenEnabled || document.mozFullScreenEnabled ||
            document.webkitFullscreenEnabled || document.msFullscreenEnabled;
    }

    static isFullScreen() {
        return document.fullscreenElement || document.mozFullScreenElement ||
            document.webkitFullscreenElement || document.msFullscreenElement;
    }

    static requestFullScreen(element) {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }

    static cancelFullScreen() {
        if (document.cancelFullScreen) { // Standard API
            document.cancelFullScreen();
        } else if (document.mozCancelFullScreen) { // Firefox
            document.mozCancelFullScreen();
        } else if (document.webkitCancelFullScreen) { // Chrome and Safari
            document.webkitCancelFullScreen();
        } else if (document.msExitFullscreen) { // IE
            document.msExitFullscreen();
        }
    }

    static toggleFullScreen(id) {
        if (FullScreenUtils.isFullScreen()) {
            FullScreenUtils.cancelFullScreen();
        } else {
            let element = document.getElementById(id);
            FullScreenUtils.requestFullScreen(element);
        }
    }
}

class Inputs  {
    constructor(modelVersion, experiment) {
        this.modelVersion = modelVersion;
        this.outputs = modelVersion.experimentTemplate.outputs;
        this._setInputs(experiment);
    }

    getInput(name) {
        let input = this.inputsArray.find(i => Utils._caseInsensitiveEquals(i.name, name));
        if (!input) throw new Error(`Input parameter "${name}" not found`);
        return Utils._convertFromString(input.value, input.type);
    }

    setInput(name, value) {
        let input = this.inputsArray.find(i => Utils._caseInsensitiveEquals(i.name, name));
        if (!input) throw new Error(`Input parameter "${name}" not found`);
        input.value = Utils._convertToString(value, input.type);
    }

    setRangeInput(name, min, max, step) {
        let input = this.inputsArray.find(i => Utils._caseInsensitiveEquals(i.name, name));
        if (!input) throw new Error(`Input parameter "${name}" not found`);
        if (input.type === "INTEGER") {
            input.type = "FIXED_RANGE_INTEGER";
            min = ~~min;
            max = ~~max;
            step = ~~step;
        } else if (input.type === "DOUBLE") {
            input.type = "FIXED_RANGE_DOUBLE";
        } else {
            throw new Error(`Input parameter "${name}" is not numeric, so range input is not available for it`);
        }
        input.value =`{"min":${min},"max":${max},"step":${step}}`;
    }

    _setInputs(experiment) {
        if (experiment) {
            this.inputsArray = experiment.inputs.map(i => Object.assign({}, i));
        } else {
            this.inputsArray = this.modelVersion.experimentTemplate.inputs.map(i => Object.assign({}, i));
            this.inputsArray.push({name: "{RANDOM_SEED}", type: "LONG", units: null, value: "1"});
        }
        this.inputsArray.sort((a, b) => {
            if (b.name > a.name) return -1;
            if (b.name < a.name) return 1;
            return 0;
        });
    }

    _getData(type) {
        return {
            inputs: this.inputsArray,
            experimentType: type
        };
    }

    _clone() {
        let newInputs = new Inputs(this.modelVersion);
        newInputs.inputsArray = this.inputsArray.map(i => Object.assign({}, i));
        return newInputs;
    }
}

class SingleRunOutputs {
    constructor(outputs) {
        this.outputs = outputs;
    }

    names() {
        return this.outputs.map(i => i.name);
    }

    findNameIncluding(namePart) {
        let names = this.outputs
            .map(o => o.name)
            .filter(n => n.toLowerCase().includes(namePart.toLowerCase().trim()));
        if (names.length === 0) throw new Error(`No output names including "${namePart}" part found`);
        if (names.length > 1) throw new Error(`Multiple output names including "${namePart}" part found`);
        return names[0];
    }

    value(name) {
        let output = this.outputs.find(i => Utils._caseInsensitiveEquals(i.name, name));
        if (!output) throw new Error(`Output value "${name}" not found`);
        return output.value;
    }

    getRawOutputs() {
        return this.outputs;
    }
}

class MultiRunOutputs {
    constructor(resultData) {
        this.inputNames = resultData.find(d => d.inputs.length > 0).inputs
            .map(d => d.name);

        this.inputsList = JSON.parse(resultData.find(d => d.inputs.length > 0).value);

        this.outputColumns = resultData
            .filter(d => d.outputs.length > 0)
            .map(d => ({ name: d.outputs[0].name, value: JSON.parse(d.value) }));

        this.outputNames = this.outputColumns.map(e => e.name);

        this.outputsList = [];
        let n = this.outputColumns[0].value.length;
        for (let i = 0; i < n; i++) {
            let values = [];
            for (let j = 0; j < this.outputColumns.length; j++) {
                values[j] = this.outputColumns[j].value[i];
            }
            this.outputsList[i] = values;
        }

        this.rawData = [];
        this.rawData.push(this.inputNames.concat(this.outputNames));
        for (let i = 0; i < this.inputsList.length; i++) {
            this.rawData.push(this.inputsList[i].concat(this.outputsList[i]));
        }
    }

    getInputNames() {
        return this.inputNames;
    }

    getOutputNames() {
        return this.outputNames;
    }

    getValuesOfInput(name) {
        let index = this.inputNames.findIndex(n => Utils._caseInsensitiveEquals(n, name));
        if (index === -1) throw new Error(`Input "${name}" not found or was not varied`);
        return this.inputsList.map(inputs => inputs[index]);
    }

    getValuesOfOutput(name) {
        let index = this.outputNames.findIndex(n => Utils._caseInsensitiveEquals(n, name));
        if (index === -1) throw new Error(`Output "${name}" not found`);
        return this.outputColumns[index].value;
    }

    getRawData() {
        return this.rawData;
    }
}

class Animation {
    constructor(cloudClient, svgClient, inputs, info) {
        this.cloudClient = cloudClient;
        this.svgClient = svgClient;
        this.inputs = inputs;
        this.info = info;
        this.nodeUrl = `${this.cloudClient.HOST_URL}/nodes/${this.info.restUrl}sessions/${this.info.sessionUuid}`;
        this.version = ALVersion.fromString(info.version);
    }

    stop() {
        this.svgClient.stop("STOPPED");
        this.cloudClient._apiRequest(`${this.nodeUrl}/stop`, "POST");
        if (this.onStopped)
            this.onStopped(this);
    }

    pause() {
        let url = `${this.nodeUrl}/command?cmd=pause&parameters=`;
        return this.cloudClient._apiRequest(url, "POST")
            .then(() => this);
    }

    resume() {
        let url = `${this.nodeUrl}/command?cmd=run&parameters=`;
        return this.cloudClient._apiRequest(url, "POST")
            .then(() => this);
    }

    setSpeed(speed) {
        let url = `${this.nodeUrl}/command?cmd=setspeed&parameters=${speed}`;
        return this.cloudClient._apiRequest(url, "POST")
            .then(() => this);
    }

    setVirtualTime() {
        let url = `${this.nodeUrl}/command?cmd=setspeed&parameters=Infinity`;
        return this.cloudClient._apiRequest(url, "POST")
            .then(() => this);
    }

    navigateTo(viewArea) {
        let url = `${this.nodeUrl}/command?cmd=navigateto&parameters=${viewArea}`;
        return this.cloudClient._apiRequest(url, "POST")
            .then(() => this);
    }

    setPresentable(pathToPresentable) {
        let url = `${this.nodeUrl}/command?cmd=setpresentable&parameters=${pathToPresentable}`;
        return this.cloudClient._apiRequest(url, "POST")
            .then(() => this);
    }

    setValue(pathToField, value) {
        if (this.version.greaterOrEquals(this.cloudClient.VERSION_SUPPORTING_EXTENDED_ANIMATION_API)) {
            let url = `${this.nodeUrl}/set-value?pathtofield=${pathToField}`;
            return this.cloudClient._apiRequest(url, "POST", { data: Utils._convertToString(value) })
                .then(() => this);
        } else {
            throw new Error(this._versionDoesNotSupportMessage("Set value"));
        }
    }

    getValue(pathToField) {
        if (this.version.greaterOrEquals(this.cloudClient.VERSION_SUPPORTING_EXTENDED_ANIMATION_API)) {
            let url = `${this.nodeUrl}/get-value?pathtofield=${pathToField}`;
            return this.cloudClient._apiRequest(url, "GET")
                .then(r => {
                    return JSON.parse(JSON.parse(r)); // Due to double serialization on server side
                });
        } else {
            throw new Error(this._versionDoesNotSupportMessage("Get value"));
        }
    }

    getState() {
        if (this.version.greaterOrEquals(this.cloudClient.VERSION_SUPPORTING_EXTENDED_ANIMATION_API)) {
            let url = `${this.nodeUrl}/get-state`;
            return this.cloudClient._apiRequest(url, "GET")
                .then(r => {
                    return JSON.parse(JSON.parse(r)); // Due to double serialization on server side
                });
        } else {
            throw new Error(this._versionDoesNotSupportMessage("Get state"));
        }
    }

    callFunction(pathToFunction, args) {
        if (this.version.greaterOrEquals(this.cloudClient.VERSION_SUPPORTING_EXTENDED_ANIMATION_API)) {
            let url = `${this.nodeUrl}/call-function?pathtofunction=${pathToFunction}`;
            return this.cloudClient._apiRequest(url, "POST", {
                data: JSON.stringify(args.map(a => JSON.stringify(a)))
            }).then(r => {
                return JSON.parse(JSON.parse(r)); // Due to double serialization on server side
            });
        } else {
            throw new Error(this._versionDoesNotSupportMessage("Call function"));
        }
    }

    waitForCompletion() {
        return new Promise(resolve => {
            this.onStopped = resolve;
        });
    }

    _versionDoesNotSupportMessage(methodName) {
        return `${methodName} is not supported by models made with AnyLogic version ${this.version}, ${this.cloudClient.VERSION_SUPPORTING_EXTENDED_ANIMATION_API} required`;
    }
}

class ModelRun {

    constructor(client, inputs, modelVersion, type) {
        this.client = client;
        this.inputs = inputs._clone();
        this.modelVersion = modelVersion;
        this.type = type;
        this.versionsUrl = this.client.OPEN_API_URL + "/versions/" + this.modelVersion.id;
    }

    run() {
        return this.client._apiRequest(this.versionsUrl + "/runs", "POST", this._getRequestParams())
            .then(() => this);
    }

    waitForCompletion(pollingPeriod) {
        if (!pollingPeriod) pollingPeriod = 5000;
        return this._pollResults(pollingPeriod);
    }

    stop() {
        return this.client._apiRequest(this.versionsUrl + "/runs/stop", "POST", this._getRequestParams())
            .then(() => this);
    }

    getStatus() {
        return this.runState.status;
    }

    getProgress() {
        if (this.runState) {
            return Promise.resolve(this.runState.message === "" ? undefined : JSON.parse(this.runState.message));
        } else {
            return this.client._apiRequest(this.versionsUrl + "/run", "POST", this._getRequestParams())
                .then(runState => {
                    return runState.message === "" ? undefined : JSON.parse(runState.message);
                });
        }
    }

    getOutputsAndRunIfAbsent(requiredOutputNames, pollingPeriod) {
        return this.getOutputs(requiredOutputNames)
            .catch(error => {
                if (error.status == 404) {
                    return this.run()
                        .then(() => this.waitForCompletion(pollingPeriod))
                        .then(() => this.getOutputs(requiredOutputNames));
                } else {
                    throw error;
                }
            });
    }

    getOutputs(requiredOutputNames) {
        return this._getRunResults(this.runState, requiredOutputNames);
    }

    _pollResults(pollingPeriod) {
        return this.client._apiRequest(this.versionsUrl + "/run", "POST", this._getRequestParams())
            .then(runState => {
                this.runState = runState;
                switch (runState.status) {
                    case "FRESH":
                    case "RUNNING":
                        return new Promise(resolve => setTimeout(() => resolve(this._pollResults(pollingPeriod)), pollingPeriod));
                    case "COMPLETED":
                        return Promise.resolve(this);
                    case "ERROR":
                    case "STOPPED":
                        return Promise.reject(runState.status);
                    default:
                        // Unexpected status
                        break;
                }
            });
    }

    _getRunResults(runState, requiredOutputNames) {
        switch (this.type) {
            case "SIMULATION":
                return this._getSimulationRunResults(runState, requiredOutputNames);
            case "PARAMETER_VARIATION":
                return this._getVariationRunResults(runState, requiredOutputNames);
            default:
                throw Error(`Unknown type of experiment "${this.type}"`);
        }
    }

    _getSimulationRunResults(runState, requiredOutputNames) {
        let aggregations = this._filterRequiredOutputs(requiredOutputNames)
            .map(output => {
                return {
                    aggregationType: "IDENTITY",
                    inputs: [],
                    outputs: [output]
                }
            });

        return this._makeRequestForResults(aggregations, runState).then(result => {
            let outputsList = result.map(r => Object.assign(
                {}, r.outputs[0], {value: Utils._convertFromString(r.value, r.type)})
            );
            return new SingleRunOutputs(outputsList);
        });
    }

    _getVariationRunResults(runState, requiredOutputNames) {
        let aggregations = this._filterRequiredOutputs(requiredOutputNames)
            .map(output => {
            return {
                aggregationType: "ARRAY",
                inputs: [],
                outputs: [output]
            }
        });
        let variableInputs = this.inputs.inputsArray
            .filter(i => i.type === "FIXED_RANGE_INTEGER" || i.type === "FIXED_RANGE_DOUBLE");
        aggregations.push({
            aggregationType: "ARRAY",
            inputs: variableInputs,
            outputs: []
        });

        return this._makeRequestForResults(aggregations, runState).then(result => {
            return new MultiRunOutputs(result);
        });
    }

    _makeRequestForResults(aggregations, runState) {
        if (runState) {
            return this.client._apiRequest(`${this.versionsUrl}/results/${runState.id}`, "POST",
                {data: JSON.stringify(aggregations), contentType: "application/json"});
        } else {
            let resultsRequest = this.inputs._getData(this.type);
            resultsRequest.outputs = JSON.stringify(aggregations);
            return this.client._apiRequest(`${this.versionsUrl}/results`, "POST",
                {data: JSON.stringify(resultsRequest), contentType: "application/json"});
        }
    }

    _filterRequiredOutputs(requiredOutputNames) {
        if (requiredOutputNames) {
            return requiredOutputNames.map(name => {
                let output = this.inputs.outputs.find(o => Utils._caseInsensitiveEquals(o.name, name))
                if (!output) throw new Error(`Output value "${name}" not found`);
                return output;
            });
        } else {
            switch (this.type) {
                case "SIMULATION":
                    return this.inputs.outputs;
                case "PARAMETER_VARIATION":
                    return this.inputs.outputs.filter(output => this._isScalarType(output.type));
                default:
                    throw Error(`Unknown type of experiment "${this.type}"`);
            }
        }
    }

    _isScalarType(type) {
        return type === "BOOLEAN" ||
            type === "INTEGER" ||
            type === "LONG" ||
            type === "DOUBLE" ||
            type === "STRING" ||
            type === "DATE_TIME"
    }

    _getRequestParams() {
        return {
            data: JSON.stringify(this.inputs._getData(this.type)),
            contentType: "application/json"
        };
    }
}

class CloudClient {
    static create(apiKey, host) {
        return new CloudClient(apiKey, host ? host : "https://cloud.anylogic.com");
    }

    constructor(apiKey, host) {
        this.VERSION = "8.5.0";
        this.SERVER_VERSION = "8.5.0";
        this.VERSION_SUPPORTING_EXTENDED_ANIMATION_API = new ALVersion(8, 5, 0);
        this.apiKey = apiKey;
        this._setHost(host);
        this._loadHeaders();
    }

    getModels() {
        return this._apiRequest(this.OPEN_API_URL + "/models");
    }

    getModelById(id) {
        return this._apiRequest(this.OPEN_API_URL + "/models/" + id);
    }

    getModelByName(name) {
        return this._apiRequest(this.OPEN_API_URL + "/models/name/" + name);
    }

    getModelVersionById(model, versionId) {
        return this._apiRequest(this.OPEN_API_URL + "/models/" + model.id + "/versions/" + versionId);
    }

    getModelVersionByNumber(model, versionNumber) {
        return this._apiRequest(this.OPEN_API_URL + "/models/" + model.id + "/versions/number/" + versionNumber);
    }

    createDefaultInputs(version) {
        return new Inputs(version);
    }

    createInputsFromExperiment(version, experimentName) {
        return this._getModelVersionExperiments(version)
            .then(experiments => {
                const experiment = experiments.find(e => e.name === experimentName);
                if (!experiment) {
                    throw new Error(`There is no experiment with name "${experimentName}" in version ${version.version}`);
                }
                return new Inputs(version, experiment);
            });
    }

    createSimulation(inputs) {
        return this._createModelRun(inputs, "SIMULATION");
    }

    createParameterVariation(inputs) {
        return this._createModelRun(inputs, "PARAMETER_VARIATION");
    }

    getLatestModelVersion(model) {
        if (typeof model === 'string' || model instanceof String) {
            let modelName = model;
            return this.getModelByName(modelName)
                .then(m => this._getLatestModelVersion(m));
        } else {
            return this._getLatestModelVersion(model);
        }
    }

    startAnimation(inputs, divId) {
        let requestData = {
            data: JSON.stringify({
                inputs: inputs.inputsArray,
                experimentType: "ANIMATION_SVG"
            }),
            contentType: "application/json"
        };
        let cloudClient = this;

        return this._apiRequest(this.OPEN_API_URL + "/versions/" + inputs.modelVersion.id + "/runs/animation", "POST", requestData).then(info => {
            return this._loadContentToDiv("assets/svg/svg-template.html", divId).then(() => {
                let svgClient = SVGFactory.createClient(info.version);
                let animation = new Animation(cloudClient, svgClient, inputs, info);
                info.host = this.HOST_URL;
                if (FullScreenUtils.isFullScreenEnabled()) {
                    svgClient.setCallback("ontogglefullscreen", () => FullScreenUtils.toggleFullScreen("svg-video-container"));
                }
                svgClient.setCallback("onstop", () => animation.stop());
                svgClient.start(info);
                return Promise.resolve(animation);
            });
        });
    }

    _getModelVersionExperiments(modelVersion) {
        return this._apiRequest(this.OPEN_API_URL + "/versions/" + modelVersion.id + "/experiments");
    }

    _getLatestModelVersion(model) {
        let versionId = model.modelVersions[model.modelVersions.length - 1];
        return this.getModelVersionById(model, versionId);
    }

    _setHost(host) {
        this.HOST_URL = host;
        this.REST_URL = this.HOST_URL + "/api";
        this.OPEN_API_URL = this.REST_URL + "/open/" + this.SERVER_VERSION;
    }

    _createModelRun(inputs, type) {
        return new ModelRun(this, inputs, inputs.modelVersion, type);
    }

    _loadContentToDiv(url, id) {
        return this._apiRequest(url, "GET", {responseType: "text"}, true).then(content => {
            document.getElementById(id).innerHTML = content;
        });
    }

    _apiRequest(url, type, params, noAuth) {
        return new Promise((resolve, reject) => {
            let xhttp = new XMLHttpRequest();
            if (!type) type = "GET";
            if (!params) params = {};
            xhttp.open(type, url, true);
            if (params.contentType)
                xhttp.setRequestHeader("Content-Type", params.contentType);
            if (!noAuth)
                xhttp.setRequestHeader("Authorization", this.apiKey);
            xhttp.onreadystatechange = function () {
                if (this.readyState == 4) {
                    if (this.status == 200) {
                        let result = xhttp.responseText;
                        if (!params.responseType)
                            result = JSON.parse(result);
                        resolve(result);
                    } else {
                        if (!params.responseType) {
                            reject(JSON.parse(this.responseText));
                        } else {
                            reject(this.status);
                        }
                    }
                }
            };
            xhttp.send(params.data);
        });
    }

    _loadHeaders() {
        this._loadScript("assets/api.bundle.js");
        this._loadStyle("assets/svg/css/presentation-html.css");
        this._loadStyle("assets/svg/css/presentation-svg.css");
    }

    _loadScript(url){
        let script = document.createElement("script");
        script.type = "text/javascript";
        // script.onload = () => callback();
        script.src = url;
        document.getElementsByTagName("head")[0].appendChild(script);
    }

    _loadStyle(url){
        let link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        document.getElementsByTagName("head")[0].appendChild(link);
    }
}

class ALVersion {

    constructor(major, minor, extra) {
        if (major === undefined || minor === undefined || extra === undefined) {
            throw new Error("Illegal argument");
        }
        this.major = major;
        this.minor = minor;
        this.extra = extra;
    }

    compare(other) {
        let res;
        res = this.major - other.major;
        if(res != 0) { return res; }
        res = this.minor - other.minor;
        if(res != 0) { return res; }
        res = this.extra - other.extra;
        return res;
    }

    between(obj1, obj2) {
        return this.compare(obj1) >= 0 && this.compare(obj2) <= 0;
    }

    greaterOrEquals(obj1) {
        return this.compare(obj1) >= 0;
    }

    static fromString(version) {
        let numbers = version.split(".");
        let major = Number(numbers[0]);
        let minor = Number(numbers[1]);
        let extra = Number(numbers[2]);
        return new ALVersion(major, minor, extra);
    }

    toString() {
        return `${this.major}.${this.minor}.${this.extra}`;
    }
}

window.CloudClient = CloudClient;
