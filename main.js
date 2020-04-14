let cloudClient = CloudClient.create("832d108c-36bb-447b-8c3b-5b183e74a3d1");

let animation;
let simulation;
let parameterVariation;
let interval;
let progressInterval;

let modelName = "DO2BR_02_24_2020";

function runAnimation() {
    cloudClient.getLatestModelVersion(modelName)
        .then(version => cloudClient.createInputsFromExperiment(version, "Experiment"))
        .then(inputs => cloudClient.startAnimation(inputs, "animation-container"))
        .then(a => {
            animation = a;
            document.getElementById("animationControls").style.display = "";
            interval = setInterval(() => {
                animation.getState().then(state => {
                    document.getElementById("animationState").textContent = state;
                });
            }, 2000);
            return animation.waitForCompletion();
        })
        .then(() => {
            document.getElementById("animationControls").style.display = "none";
            // stop polling: runningAnimation.getState();​
            clearInterval(interval);
        })
        .catch(error => console.error(error));
}

function runSimulation() {
    cloudClient.getLatestModelVersion( modelName )
        .then( version => {
            let inputs = cloudClient.createDefaultInputs( version );
            inputs.setInput( "Contact Rate", 40.0 );
            inputs.setInput( "{stop_mode}", "STOP_MODE_AT_TIME" );
            inputs.setInput( "{start_date}", new Date(100000000) ); // Case insensitive
            inputs.setInput( "{max_memory_MB}", 1024.1111 ); // Will be rounded to integer value
            console.log(inputs.getInput("Contact Rate"));
            console.log(inputs.getInput("{STOP_MODE}"));
            console.log(inputs.getInput("{start_date}"));
            console.log(inputs.getInput("{max_memory_MB}"));
            simulation = cloudClient.createSimulation(inputs);
            return simulation.getOutputsAndRunIfAbsent([
                "AdoptionPlot|Potential Adopters",
                "AdoptionPercent"
            ]);
        })
        .then( outputs => {
            console.log(outputs.names());
            console.log(outputs.value(outputs.findNameIncluding("Percent")));
            console.log(outputs.getRawOutputs());
            document.getElementById( "text-output" ).innerText = "AdoptionPercent = " + outputs.value("adoptionPercent");
        })
        .catch( error => console.error(error) );
}

function runParameterVariation() {
    cloudClient.getLatestModelVersion( modelName )
        .then( version => {
            let inputs = cloudClient.createDefaultInputs( version );
            inputs.setRangeInput( "Contact Rate", 21, 41, 20 );
            inputs.setRangeInput( "Adoption Fraction", 0.02, 0.04, 0.01 );
            inputs.setRangeInput( "Ad Effectiveness", 0.015, 0.065, 0.01 );
            console.log(inputs.getInput("Contact Rate"));
            parameterVariation = cloudClient.createParameterVariation(inputs);
            startProgressPolling();
            return parameterVariation.run();
        })
        .then( parameterVariation => parameterVariation.waitForCompletion() )
        .then( parameterVariation => parameterVariation.getOutputs([
            "AdoptionPlot|Potential Adopters",
            "AdoptionPercent"
        ]) )
        .then( outputs => {
            console.log(outputs.getInputNames());
            console.log(outputs.getOutputNames());
            console.log(outputs.getValuesOfInput("Ad Effectiveness"));
            console.log(outputs.getValuesOfOutput("AdoptionPercent"));
            console.log(outputs.getRawData());
            document.getElementById( "text-output" ).innerText = "AdoptionPercent = " + outputs.getValuesOfOutput("AdoptionPercent");
            console.log( "AdoptionPercent = ", outputs.getValuesOfOutput("AdoptionPercent") );
        })
        .catch( error => console.error(error) )
        .finally(() => {
            endProgressPolling();
        });
}

function startProgressPolling() {
    progressInterval = setInterval(() => {
        parameterVariation.getProgress()
            .then(progress => console.log(progress))
    }, 2000);
}

function endProgressPolling() {
    clearInterval(progressInterval);
}

function runThreeParallelSimulations() {
    let crValues = [ 20, 50, 100 ]; //three values for Contact Rate parameter

    cloudClient.getLatestModelVersion( modelName )
        .then( version => {
            let tasks = []; //this will be array of Promises
            for ( let cr of crValues ) {
                //launch 3 runs in parallel
                let inputs = cloudClient.createDefaultInputs( version );
                inputs.setInput( "Contact Rate", cr );
                let simulation = cloudClient.createSimulation( inputs );
                tasks.push( simulation.getOutputsAndRunIfAbsent() ); //add run Promise to the array
            }
            return Promise.all( tasks ); //this waits for ALL promises to complete
        })
        .then( outputsArray => { //we now have array of three Output objects (order is kept)
            let text = "";
            for( let i = 0; i < crValues.length; i++ ) {
                //find and print some particular output and the corresp input
                text += "Contact Rate = " + crValues[i] + " --> " + "Adoption Percent = " + outputsArray[i].value("AdoptionPercent" ) + "\n";
            }
            document.getElementById( "text-output" ).innerText = text;
            console.log( text );
        })
        .catch( error => console.error(error) )
}

function stopSimulation() {
    simulation.stop();
}

function stopParameterVariation() {
    parameterVariation.stop();
}

function stopAnimation() {
    animation.stop();
}

function pause() {
    animation.pause();
}

function resume() {
    animation.resume();
}

function increaseSpeed() {
    animation.setSpeed(10);
}

function navigateToNotification() {
    animation.navigateTo('notificationArea');
}

function goToAgent() {
    animation.setPresentable('experiment.root.presentableAgent');
}

function setParameters() {
    animation.setValue('experiment.root.parameter1', 42);
    animation.setValue('experiment.root.parameter2', null);
    animation.setValue('experiment.root.parameter3', ['123', '234']);
    animation.setValue('experiment.root.parameter4', {name: "Вася", weight: 111.11});
}

function getParameters() {
    animation.getValue('experiment.root.parameter1')
        .then(value => console.log('parameter1: ', value));

    animation.getValue('experiment.root.parameter2')
        .then(value => console.log('parameter2: ', value));

    animation.getValue('experiment.root.parameter3')
        .then(value => console.log('parameter3: ', value));

    animation.getValue('experiment.root.parameter4')
        .then(value => console.log('parameter4: ', value));

    animation.getValue('experiment.root._plot1_expression0_dataSet_xjal')
        .then(value => console.log('_plot1_expression0_dataSet_xjal: ', value));
}

function callFunction() {
    animation.callFunction('experiment.root.function', [2.42, [10, 30]])
        .then(result => console.log(result));
}