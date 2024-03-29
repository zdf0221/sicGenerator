var MIN_NOTE = 48;
  var MAX_NOTE = 83;
  var SEQ_LENGTH = 32;
  var HUMANIZE_TIMING = 0.0085;
  var N_INTERPOLATIONS = 10;
  var CHORD_SYMBOLS = {
    major: 'M',
    minor: 'm',
    major7th: 'M7',
    minor7th: 'm7',
    dominant7th: '7',
    sus2: 'Msus2',
    sus4: 'Msus4' };

  var SAMPLE_SCALE = [
    'C3',
    'D#3',
    'F#3',
    'A3',
    'C4',
    'D#4',
    'F#4',
    'A4',
    'C5',
    'D#5',
    'F#5',
    'A5'];


  var Tone = mm.Player.tone;

  Tone.Transport.bpm.value = 90;

  var vae = new mm.MusicVAE(
    'https://storage.googleapis.com/download.magenta.tensorflow.org/tfjs_checkpoints/music_vae/mel_2bar_small');

  var rnn = new mm.MusicRNN(
    'https://storage.googleapis.com/download.magenta.tensorflow.org/tfjs_checkpoints/music_rnn/chord_pitches_improv');


  var reverb = new Tone.Convolver(
    'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/hm2_000_ortf_48k.mp3').
  toMaster();
  reverb.wet.value = 0.15;
  var samplers = [
    {
      high: buildSampler(
        'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/marimba-classic-').
      connect(new Tone.Panner(-0.4).connect(reverb)),
      mid: buildSampler(
        'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/marimba-classic-mid-').
      connect(new Tone.Panner(-0.4).connect(reverb)),
      low: buildSampler(
        'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/marimba-classic-low-').
      connect(new Tone.Panner(-0.4).connect(reverb)) },

    {
      high: buildSampler(
        'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/xylophone-dark-').
      connect(new Tone.Panner(0.4).connect(reverb)),
      mid: buildSampler(
        'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/xylophone-dark-mid-').
      connect(new Tone.Panner(0.4).connect(reverb)),
      low: buildSampler(
        'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/xylophone-dark-low-').
      connect(new Tone.Panner(0.4).connect(reverb)) }];



  var sixteenth = Tone.Time('16n').toSeconds();
  var quarter = Tone.Time('4n').toSeconds();
  var temperature = 1.1;
  var loadingIndicator = document.querySelector('#loading');
  var generatingIndicator = document.querySelector('#generating');
  var container = document.querySelector('#vis-elements');
  var haloContainer = document.querySelector('#vis-halos');
  var tonicLeftButtons = document.querySelectorAll('.tonic-left');
  var tonicRightButtons = document.querySelectorAll('.tonic-right');
  var chordLeftButtons = document.querySelectorAll('.chord-left');
  var chordRightButtons = document.querySelectorAll('.chord-right');
  var tempoSelector = document.querySelector('#tempo-selector');
  var tempoLabel = document.querySelector('#tempo-label');
  var midiRequiredStuff = Array.from(document.querySelectorAll('.midi-required'));
  var outputSelector = document.querySelector('#output-selector');
  var tempoSourceSelector = document.querySelector('#tempo-source-selector');
var genBtn = document.querySelector('#genBtn');

  var currentStep = 0;
  var sequences = [];
  var mouseDown = false;
  var chordLeft = CHORD_SYMBOLS['major'],
    chordRight = CHORD_SYMBOLS['major'];
  var tonicLeft = 0,
    tonicRight = 0;
  var currentMidiOutput = void 0;
  var transportPlayerId = null;
  var result

  var myVelocity = ''

  function buildSampler(urlPrefix) {
    return new Tone.Sampler(
      _.fromPairs(
        SAMPLE_SCALE.map(function (n) {return [
          n,
          new Tone.Buffer('' + urlPrefix + n.toLowerCase().replace('#', 's') + '.mp3')];})));



  }

  function generateSeq(chord, startNotes) {
    var seedSeq = toNoteSequence(startNotes);
    return rnn.continueSequence(seedSeq, SEQ_LENGTH, temperature, [chord]);
  }

  function toNoteSequence(seq) {
    var notes = [];
    for (var i = 0; i < seq.length; i++) {
      if (seq[i] === -1 && notes.length) {
        _.last(notes).endTime = i * 0.5;
      } else if (seq[i] !== -2 && seq[i] !== -1) {
        if (notes.length && !_.last(notes).endTime) {
          _.last(notes).endTime = i * 0.5;
        }
        notes.push({
          pitch: seq[i],
          startTime: i * 0.5 });

      }
    }
    if (notes.length && !_.last(notes).endTime) {
      _.last(notes).endTime = seq.length * 0.5;
    }
    return mm.sequences.quantizeNoteSequence(
      {
        ticksPerQuarter: 220,
        totalTime: seq.length * 0.5,
        quantizationInfo: {
          stepsPerQuarter: 1 },

        timeSignatures: [
          {
            time: 0,
            numerator: 4,
            denominator: 4 }],


        tempos: [
          {
            time: 0,
            qpm: 120 }],


        notes: notes },

      1);

  }

  function isValidNote(note) {var forgive = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    return note <= MAX_NOTE + forgive && note >= MIN_NOTE - forgive;
  }

  function octaveShift(note) {
    var shift = MAX_NOTE - note > note - MIN_NOTE ? 12 : -12;
    var delta = 0;
    while (isValidNote(note + delta + shift)) {
      delta += shift;
    }
    return note + delta;
  }

  function transposeIntoRange(note) {
    while (note > MAX_NOTE) {
      note -= 12;
    }
    while (note < MIN_NOTE) {
      note += 12;
    }
    return note;
  }

  function mountChord(tonic, chord) {
    return Tone.Frequency(tonic, 'midi').toNote() + chord;
  }

  function restPad(note) {
    if (Math.random() < 0.6) {
      return [note, -2];
    } else if (Math.random() < 0.8) {
      return [note];
    } else {
      return [note, -2, -2];
    }
  }

  function playStep() {var time = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Tone.now() - Tone.context.lookAhead;
    var notesToPlay = distributeNotesToPlay(
      collectNotesToPlay(currentStep % SEQ_LENGTH));var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {

      for (var _iterator = notesToPlay[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var _ref2 = _step.value;var delay = _ref2.delay,notes = _ref2.notes;
        var voice = 0;
        var stepSamplers = _.shuffle(samplers);var _iteratorNormalCompletion2 = true;var _didIteratorError2 = false;var _iteratorError2 = undefined;try {var _loop = function _loop() {var _ref3 = _step2.value;var
          pitch = _ref3.pitch,path = _ref3.path,halo = _ref3.halo;
          var freq = Tone.Frequency(pitch, 'midi');
          var playTime = time + delay + HUMANIZE_TIMING * Math.random();
          var velocity = void 0;
          if (delay === 0) velocity = 'high';else
          if (delay === sixteenth / 2) velocity = 'mid';else
            velocity = 'low';

          if (currentMidiOutput) {
            var _delay = (playTime - Tone.now() + Tone.context.lookAhead) * 1000;
            var duration = Tone.Time('16n').toMilliseconds();
            var midiVelocity = { high: 1, mid: 0.75, low: 0.5 }[velocity];
            currentMidiOutput.playNote(freq.toNote(), 'all', {
              time: _delay > 0 ? '+' + _delay : WebMidi.now,
              velocity: midiVelocity,
              duration: duration });

          } else {
            stepSamplers[voice++ % stepSamplers.length][velocity].triggerAttack(
              freq,
              playTime);

          }
          Tone.Draw.schedule(function () {return animatePlay(path, halo);}, playTime);};for (var _iterator2 = notes[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {_loop();
        }} catch (err) {_didIteratorError2 = true;_iteratorError2 = err;} finally {try {if (!_iteratorNormalCompletion2 && _iterator2.return) {_iterator2.return();}} finally {if (_didIteratorError2) {throw _iteratorError2;}}}
      }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator.return) {_iterator.return();}} finally {if (_didIteratorError) {throw _iteratorError;}}}
    currentStep++;
  }

  function collectNotesToPlay(step) {
    var notesToPlay = [];var _iteratorNormalCompletion3 = true;var _didIteratorError3 = false;var _iteratorError3 = undefined;try {
      for (var _iterator3 = sequences[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {var seq = _step3.value;
        if (!seq.on) continue;
        if (seq.notes.has(step)) {
          notesToPlay.push(seq.notes.get(step));
        }
      }} catch (err) {_didIteratorError3 = true;_iteratorError3 = err;} finally {try {if (!_iteratorNormalCompletion3 && _iterator3.return) {_iterator3.return();}} finally {if (_didIteratorError3) {throw _iteratorError3;}}}
    return _.shuffle(notesToPlay);
  }

  function distributeNotesToPlay(notes) {
    var subdivisions = [
      { delay: 0, notes: [] },
      { delay: sixteenth / 2, notes: [] },
      { delay: sixteenth, notes: [] },
      { delay: sixteenth * 3 / 2, notes: [] }];

    if (notes.length) {
      subdivisions[0].notes.push(notes.pop());
    }
    if (notes.length) {
      subdivisions[2].notes.push(notes.pop());
    }
    while (notes.length && Math.random() < Math.min(notes.length, 6) / 10) {
      var rnd = Math.random();
      var subdivision = void 0;
      if (rnd < 0.4) {
        subdivision = 0;
      } else if (rnd < 0.6) {
        subdivision = 1;
      } else if (rnd < 0.8) {
        subdivision = 2;
      } else {
        subdivision = 3;
      }
      subdivisions[subdivision].notes.push(notes.pop());
    }
    return subdivisions;
  }

  function animatePlay(pathEl, haloEl) {
    pathEl.animate([{ fill: 'white' }, { fill: '#e91e63' }], {
      duration: quarter * 1000,
      easing: 'ease-out' });

    haloEl.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: quarter * 1000,
      easing: 'ease-out' });

  }

  function toggleSeq(seqObj) {
    if (seqObj.on) {
      seqObj.on = false;
      seqObj.group.setAttribute('class', '');
    } else {
      seqObj.on = true;
      seqObj.group.setAttribute('class', 'on');
    }
  }

  function toggleHover(seqObj, on) {
    var cls = seqObj.group.getAttribute('class') || '';
    if (on && cls.indexOf('hover') < 0) {
      seqObj.group.setAttribute('class', cls + ' hover');
    } else if (!on && cls.indexOf('hover') >= 0) {
      seqObj.group.setAttribute('class', cls.replace('hover', ''));
    }
  }

  function buildSlice(centerX, centerY, startAngle, endAngle, radius) {
    var startX = centerX + Math.cos(startAngle) * radius;
    var startY = centerY + Math.sin(startAngle) * radius;
    var endX = centerX + Math.cos(endAngle) * radius;
    var endY = centerY + Math.sin(endAngle) * radius;
    var pathString = 'M ' + centerX + ' ' + centerY + ' L ' + startX + ' ' + startY + ' A ' + radius + ' ' + radius + ' 0 0 1 ' + endX + ' ' + endY + ' Z';
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathString);
    path.setAttribute('style', 'transform-origin: ' + centerX + 'px ' + centerY + 'px');
    return path;
  }

  function buildSeed(chord) {
    var notes = Tonal.Chord.notes(chord).
    map(function (n) {return Tonal.Note.midi(n);}).
    map(transposeIntoRange);
    return _.flatMap(_.shuffle(notes), restPad);
  }

  function generateSpace() {
    var previouslyOn = _.fromPairs(sequences.map(function (s, idx) {return [idx, s.on];}));
    var chords = [
      mountChord(octaveShift(MIN_NOTE + tonicLeft), chordLeft),
      mountChord(MIN_NOTE + tonicLeft, chordLeft),
      mountChord(octaveShift(MIN_NOTE + tonicRight), chordRight),
      mountChord(MIN_NOTE + tonicRight, chordRight)];

    return Promise.all([
      generateSeq(chords[0], buildSeed(chords[0])),
      generateSeq(chords[1], buildSeed(chords[1])),
      generateSeq(chords[2], buildSeed(chords[2])),
      generateSeq(chords[3], buildSeed(chords[3]))]).

    then(function (noteSeqs) {return vae.interpolate(noteSeqs, N_INTERPOLATIONS);}).
    then(function (res) {
      result = res
      while (container.firstChild) {
        container.firstChild.remove();
      }
      while (haloContainer.firstChild) {
        haloContainer.firstChild.remove();
      }
      var cellSize = 1000 / N_INTERPOLATIONS;
      var margin = cellSize / 30;

      sequences = res.map(function (noteSeq, idx) {
        var row = Math.floor(idx / N_INTERPOLATIONS);
        var col = idx - row * N_INTERPOLATIONS;
        var centerX = (col + 0.5) * cellSize + margin;
        var centerY = (row + 0.5) * cellSize + margin;
        var maxInterval = MAX_NOTE;
        var maxRadius = cellSize / 2 - 2 * margin;

        var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        if (previouslyOn[idx]) {
          group.setAttribute('class', 'on');
        }
        group.style.transformOrigin = centerX + 'px ' + centerY + 'px';
        group.style.transform = 'scale(0)';
        group.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], {
          duration: 200,
          delay:
          (N_INTERPOLATIONS / 2 - Math.abs(row - N_INTERPOLATIONS / 2)) * 25 +
          (N_INTERPOLATIONS / 2 - Math.abs(col - N_INTERPOLATIONS / 2)) * 25,
          fill: 'forwards' });

        container.appendChild(group);

        var halo = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'circle');

        halo.setAttribute('class', 'halo');
        halo.setAttribute('fill', 'url(#halo');
        halo.setAttribute('cx', centerX);
        halo.setAttribute('cy', centerY);
        halo.setAttribute('r', maxRadius + 2);
        haloContainer.appendChild(halo);

        var notes = new Map();var _iteratorNormalCompletion4 = true;var _didIteratorError4 = false;var _iteratorError4 = undefined;try {
          for (var _iterator4 = noteSeq.notes[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {var _step4$value = _step4.value;pitch = _step4$value.pitch;quantizedStartStep = _step4$value.quantizedStartStep;quantizedEndStep = _step4$value.quantizedEndStep;
            if (!isValidNote(pitch, 4)) {
              continue;
            }
            var relPitch = (maxInterval - (pitch - MIN_NOTE)) / maxInterval;
            var radius = relPitch * maxRadius;
            var startAngle = quantizedStartStep / SEQ_LENGTH * Math.PI * 2;
            var endAngle = quantizedEndStep / SEQ_LENGTH * Math.PI * 2;

            var _path = buildSlice(centerX, centerY, startAngle, endAngle, radius);
            _path.setAttribute('class', 'note');
            group.appendChild(_path);
            notes.set(quantizedStartStep, {
              pitch: pitch,
              path: _path,
              halo: halo });

          }} catch (err) {_didIteratorError4 = true;_iteratorError4 = err;} finally {try {if (!_iteratorNormalCompletion4 && _iterator4.return) {_iterator4.return();}} finally {if (_didIteratorError4) {throw _iteratorError4;}}}

        var pointerArea = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'rect');

        pointerArea.setAttribute('x', col * cellSize);
        pointerArea.setAttribute('y', row * cellSize);
        pointerArea.setAttribute('width', cellSize);
        pointerArea.setAttribute('height', cellSize);
        pointerArea.setAttribute('class', 'pointer-area');
        group.appendChild(pointerArea);

        var seqObj = { notes: notes, group: group, on: previouslyOn[idx] };

        pointerArea.addEventListener('mousedown', function () {return toggleSeq(seqObj);});
        pointerArea.addEventListener('mouseover', function () {
          toggleHover(seqObj, true);
          mouseDown && toggleSeq(seqObj);
        });
        pointerArea.addEventListener('mouseout', function () {return (
          toggleHover(seqObj, false));});

        return seqObj;
      });
    });
  }

  function regenerateSpace() {
    // Pause Tone timeline while regenerating so events don't pile up if it's laggy.
    Tone.Transport.pause();
    generatingIndicator.style.display = 'flex';
    setTimeout(function () {
      generatingIndicator.style.display = 'none';
      generateSpace().then(function () {
        setTimeout(function () {return Tone.Transport.start();}, 0);
      });
    }, 0);
  }

  function startTransportPlay() {
    if (_.isNull(transportPlayerId)) {
      transportPlayerId = Tone.Transport.scheduleRepeat(playStep, '16n');
    }
  }

  function stopTransportPlay() {
    if (!_.isNull(transportPlayerId)) {
      Tone.Transport.clear(transportPlayerId);
      transportPlayerId = null;
    }
  }

  Promise.all([
    rnn.initialize(),
    vae.initialize(),
    new Promise(function (res) {return Tone.Buffer.on('load', res);})]).

  then(generateSpace).
  then(function () {return loadingIndicator.style.display = 'none';}).
  then(function () {
    startTransportPlay();
    Tone.Transport.start();
  });

  document.documentElement.addEventListener(
    'mousedown',
    function () {return mouseDown = true;});

  document.documentElement.addEventListener('mouseup', function () {return mouseDown = false;});

  tonicLeftButtons.forEach(function (el) {return (
    el.addEventListener('click', function (evt) {
      tonicLeft = +evt.target.dataset.tonic;
      tonicLeftButtons.forEach(function (b) {return (
        b.classList.toggle('active', b === evt.target));});

      regenerateSpace();
    }));});

  tonicRightButtons.forEach(function (el) {return (
    el.addEventListener('click', function (evt) {
      tonicRight = +evt.target.dataset.tonic;
      tonicRightButtons.forEach(function (b) {return (
        b.classList.toggle('active', b === evt.target));});

      regenerateSpace();
    }));});

  chordLeftButtons.forEach(function (el) {return (
    el.addEventListener('click', function (evt) {
      chordLeft = CHORD_SYMBOLS[evt.target.dataset.chord];
      chordLeftButtons.forEach(function (b) {return (
        b.classList.toggle('active', b === evt.target));});

      regenerateSpace();
    }));});

  chordRightButtons.forEach(function (el) {return (
    el.addEventListener('click', function (evt) {
      chordRight = CHORD_SYMBOLS[evt.target.dataset.chord];
      chordRightButtons.forEach(function (b) {return (
        b.classList.toggle('active', b === evt.target));});

      regenerateSpace();
    }));});


  tempoSelector.addEventListener('input', function () {
    Tone.Transport.bpm.value = +tempoSelector.value;
    tempoLabel.innerText = tempoSelector.value;
  });

  WebMidi.enable(function (err) {
    if (err) {
      console.log(err);
    } else {var


      updateSelectors = function updateSelectors() {
        while (outputSelector.firstChild) {
          outputSelector.firstChild.remove();
        }

        var internalOutputOption = document.createElement('option');
        internalOutputOption.value = 'internal';
        internalOutputOption.textContent = 'Internal';
        internalOutputOption.checked = true;
        outputSelector.appendChild(internalOutputOption);var _iteratorNormalCompletion5 = true;var _didIteratorError5 = false;var _iteratorError5 = undefined;try {
          for (var _iterator5 = WebMidi.outputs[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {var output = _step5.value;
            var outputOption = document.createElement('option');
            outputOption.value = output.id;
            outputOption.textContent = output.name;
            outputSelector.appendChild(outputOption);
          }} catch (err) {_didIteratorError5 = true;_iteratorError5 = err;} finally {try {if (!_iteratorNormalCompletion5 && _iterator5.return) {_iterator5.return();}} finally {if (_didIteratorError5) {throw _iteratorError5;}}}
        onOutputChange();

        while (tempoSourceSelector.firstChild) {
          tempoSourceSelector.firstChild.remove();
        }
        var internalTempoSourceOption = document.createElement('option');
        internalTempoSourceOption.value = 'internal';
        internalTempoSourceOption.textContent = 'Internal';
        tempoSourceSelector.appendChild(internalTempoSourceOption);var _iteratorNormalCompletion6 = true;var _didIteratorError6 = false;var _iteratorError6 = undefined;try {
          for (var _iterator6 = WebMidi.inputs[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {var input = _step6.value;
            var tempoSourceOption = document.createElement('option');
            tempoSourceOption.value = input.id;
            tempoSourceOption.textContent = 'MIDI clock from ' + input.name;
            tempoSourceSelector.appendChild(tempoSourceOption);
          }} catch (err) {_didIteratorError6 = true;_iteratorError6 = err;} finally {try {if (!_iteratorNormalCompletion6 && _iterator6.return) {_iterator6.return();}} finally {if (_didIteratorError6) {throw _iteratorError6;}}}
        onTempoSourceChange();
      };var

      onOutputChange = function onOutputChange() {
        var outputId = outputSelector.value;
        if (outputId === 'internal') {
          currentMidiOutput = null;
        } else {
          currentMidiOutput = WebMidi.getOutputById(outputId);
        }
      };var



      incomingMidiClockStart = function incomingMidiClockStart() {
        currentStep = 0;
        midiClockTick = 0;
      };var

      incomingMidiClockStop = function incomingMidiClockStop() {
        currentStep = 0;
        midiClockTick = 0;
      };var

      incomingMidiClockTick = function incomingMidiClockTick() {
        if (midiClockTick++ % 6 === 0) {
          playStep();
        }
      };var

      onTempoSourceChange = function onTempoSourceChange() {
        myVelocity = inputId
        var inputId = tempoSourceSelector.value;
        if (inputId === 'internal') {var _iteratorNormalCompletion7 = true;var _didIteratorError7 = false;var _iteratorError7 = undefined;try {
          for (var _iterator7 = WebMidi.inputs[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {var input = _step7.value;
            input.removeListener('start', 'all', incomingMidiClockStart);
            input.removeListener('stop', 'all', incomingMidiClockStop);
            input.removeListener('clock', 'all', incomingMidiClockTick);
          }} catch (err) {_didIteratorError7 = true;_iteratorError7 = err;} finally {try {if (!_iteratorNormalCompletion7 && _iterator7.return) {_iterator7.return();}} finally {if (_didIteratorError7) {throw _iteratorError7;}}}
          startTransportPlay();

          tempoSelector.disabled = false;
          tempoSelector.style.opacity = 1;
          tempoLabel.style.opacity = 1;
        } else {
          stopTransportPlay();
          var _input = WebMidi.getInputById(inputId);
          
          _input.addListener('start', 'all', incomingMidiClockStart);
          _input.addListener('stop', 'all', incomingMidiClockStop);
          _input.addListener('clock', 'all', incomingMidiClockTick);

          tempoSelector.disabled = true;
          tempoSelector.style.opacity = 0;
          tempoLabel.style.opacity = 0;
        }
      };midiRequiredStuff.forEach(function (el) {return el.classList.remove('midi-required');});var midiClockTick = 0;

      updateSelectors();

      WebMidi.addListener('connected', updateSelectors);
      WebMidi.addListener('disconnected', updateSelectors);
      outputSelector.addEventListener('change', onOutputChange);
      tempoSourceSelector.addEventListener('change', onTempoSourceChange);
    }
  });

  StartAudioContext(Tone.context, container);


  genBtn.addEventListener('click', function (e) {
    
    let v = document.querySelector('#tempo-selector').value
    var aimSequence = []
    for (var i = 0; i < sequences.length; i++) {
      if (sequences[i].on){
        for(let m = 0; m < result[i].notes.length; m++){
          result[i].notes[m].velocity = v
        }
        aimSequence.push(result[i])
      }
      console.log('hereh')
    }

    $.ajaxSetup({
      headers:
        { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content'),
          'Access-Control-Allow-Origin': 'http://localhost:5000/apiGiven'
        }

    });
    $.ajax({
      type: "POST",
      url: "http://127.0.0.1:5000/apiGiven",
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify(aimSequence),
      dataType: "json",
      success: function (message) {
        console.log(message)
      },
      error: function (message) {
        $("#request-process-patent").html("提交数据失败！");
      }
    });
    e.preventDefault()
  });