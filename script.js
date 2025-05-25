// Stores the weighted participant names
let entries = [];

// Controls the start angle of the spinning wheel
let startAngle = 0;

// Holds reference to the spin timer
let spinTimeout = null;

// Defines the amount of angle to rotate on each frame
let spinAngle = 0;

// Tracks the elapsed spin time
let spinTime = 0;

// Total duration the wheel should spin
let spinTimeTotal = 0;

// Canvas context for drawing the wheel
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");

/**
 * Generates input fields based on the number of participants entered
 */
function generateInputs() {
  const num = parseInt(document.getElementById("numParticipants").value);
  const form = document.getElementById("participantForm");
  form.innerHTML = "";

  if (isNaN(num) || num < 1) return;

  for (let i = 0; i < num; i++) {
    const div = document.createElement("div");

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = `Name ${i + 1}`;
    nameInput.required = true;

    const weightInput = document.createElement("input");
    weightInput.type = "number";
    weightInput.placeholder = "Weight";
    weightInput.value = 1;
    weightInput.min = 1;

    div.appendChild(nameInput);
    div.appendChild(weightInput);
    form.appendChild(div);
  }

  document.getElementById("pickWinner").style.display = "inline-block";
  document.getElementById("resetBtn").style.display = "inline-block";
  document.getElementById("wheelCanvas").style.display = "none";
  document.getElementById("winnerResult").innerText = "";
}

/**
 * Extracts all valid names and applies their weights
 * Returns an array where names appear multiple times based on weight
 */
function getWeightedNames() {
  const form = document.getElementById("participantForm");
  const divs = form.querySelectorAll("div");
  const names = [];

  divs.forEach((div) => {
    const inputs = div.querySelectorAll("input");
    const name = inputs[0].value.trim();
    const weight = parseInt(inputs[1].value);

    if (name && !isNaN(weight) && weight > 0) {
      for (let i = 0; i < weight; i++) {
        names.push(name);
      }
    }
  });

  return names;
}

/**
 * Triggers the drawing and spinning of the wheel based on input
 */
function pickWinner() {
  entries = getWeightedNames();
  if (entries.length === 0) {
    alert("Please enter at least one valid participant name and weight.");
    return;
  }

  document.getElementById("wheelCanvas").style.display = "block";
  document.getElementById("winnerResult").innerText = "";

  drawWheel();
  spinWheel();
}

/**
 * Resets all inputs and visual elements to initial state
 */
function resetApp() {
  document.getElementById("numParticipants").value = "";
  document.getElementById("participantForm").innerHTML = "";
  document.getElementById("pickWinner").style.display = "none";
  document.getElementById("resetBtn").style.display = "none";
  document.getElementById("wheelCanvas").style.display = "none";
  document.getElementById("winnerResult").innerText = "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Draws the roulette-style wheel using canvas API
 */
function drawWheel() {
  const arc = Math.PI * 2 / entries.length;
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = 300 * pixelRatio;
  canvas.height = 300 * pixelRatio;
  canvas.style.width = "300px";
  canvas.style.height = "300px";

  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform matrix
  ctx.scale(pixelRatio, pixelRatio); // Apply scaling for high DPI

  ctx.clearRect(0, 0, 300, 300);
  canvas.style.display = 'block';

  for (let i = 0; i < entries.length; i++) {
    const angle = startAngle + i * arc;
    const hue = (360 / entries.length) * i;
    ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;

    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.arc(150, 150, 130, angle, angle + arc, false);
    ctx.lineTo(150, 150);
    ctx.fill();

    ctx.save();
    ctx.fillStyle = "white";
    ctx.translate(150, 150);
    ctx.rotate(angle + arc / 2);
    ctx.textAlign = "right";
    ctx.font = "12px Poppins";
    ctx.fillText(entries[i], 120, 5);
    ctx.restore();
  }

  // Draws the pointer triangle at the top center
  ctx.fillStyle = "#d32f2f";
  ctx.beginPath();
  ctx.moveTo(150, 15);
  ctx.lineTo(140, 0);
  ctx.lineTo(160, 0);
  ctx.closePath();
  ctx.fill();
}

/**
 * Initiates spin variables and starts the spinning animation
 */
function spinWheel() {
  spinAngle = Math.random() * 0.2 + 0.3;
  spinTime = 0;
  spinTimeTotal = Math.random() * 3000 + 4000;
  rotateWheel();
}

/**
 * Repeatedly rotates the wheel by updating the angle and redrawing
 */
function rotateWheel() {
  spinTime += 30;
  if (spinTime >= spinTimeTotal) {
    stopRotateWheel();
    return;
  }

  const spinAngleIncrement = easeOut(spinTime, 0, spinAngle, spinTimeTotal);
  startAngle += spinAngleIncrement;
  drawWheel();
  spinTimeout = setTimeout(rotateWheel, 30);
}

/**
 * Finalizes the wheel rotation, determines the winner, and triggers confetti
 */
function stopRotateWheel() {
  clearTimeout(spinTimeout);

  const arc = (2 * Math.PI) / entries.length;
  const normalizedAngle = (startAngle + Math.PI / 2) % (2 * Math.PI);
  const index = Math.floor((entries.length - (normalizedAngle / arc)) % entries.length);
  const winner = entries[index];

  document.getElementById("winnerResult").innerText = `🎉 Winner: ${winner}! 🎉`;

  confetti({
    particleCount: 200,
    spread: 70,
    origin: { y: 0.6 }
  });
}

/**
 * Custom easing function to slow the spin over time
 */
function easeOut(t, b, c, d) {
  const ts = (t /= d) * t;
  const tc = ts * t;
  return b + c * (tc + -3 * ts + 3 * t);
}
