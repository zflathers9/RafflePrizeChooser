let entries = [];
let startAngle = 0;
let spinTimeout = null;
let spinAngle = 0;
let spinTime = 0;
let spinTimeTotal = 0;

const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");

function generateInputs() {
  const form = document.getElementById('participantForm');
  const count = parseInt(document.getElementById('numParticipants').value);
  form.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const div = document.createElement('div');

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = `Name #${i + 1}`;
    nameInput.required = true;

    const entryInput = document.createElement('input');
    entryInput.type = 'number';
    entryInput.min = '1';
    entryInput.placeholder = 'Entries';
    entryInput.required = true;

    div.appendChild(nameInput);
    div.appendChild(entryInput);
    form.appendChild(div);
  }

  document.getElementById('pickWinner').style.display = 'inline-block';
  document.getElementById('resetBtn').style.display = 'inline-block';
  document.getElementById('winnerResult').innerText = '';
  document.getElementById('wheelCanvas').style.display = 'none';
}

function pickWinner() {
  const form = document.getElementById('participantForm');
  entries = [];

  for (let i = 0; i < form.children.length; i++) {
    const inputs = form.children[i].getElementsByTagName('input');
    const name = inputs[0].value.trim();
    const count = parseInt(inputs[1].value);

    if (name && count > 0) {
      for (let j = 0; j < count; j++) {
        entries.push(name);
      }
    }
  }

  if (entries.length === 0) {
    alert("Please enter valid names and entries.");
    return;
  }

  drawWheel();
  spinWheel();
}

function drawWheel() {
  const arc = Math.PI * 2 / entries.length;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.style.display = 'block';

  // Draw wheel segments
  for (let i = 0; i < entries.length; i++) {
    const angle = startAngle + i * arc;
    ctx.fillStyle = i % 2 === 0 ? "#00796b" : "#009688";

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

  // Draw downward-pointing triangle at top center
  ctx.fillStyle = "#d32f2f";
  ctx.beginPath();
  ctx.moveTo(150, 20);     // Tip of triangle (points down)
  ctx.lineTo(140, 0);      // Top left
  ctx.lineTo(160, 0);      // Top right
  ctx.closePath();
  ctx.fill();
}

function spinWheel() {
  spinAngle = Math.random() * 0.2 + 0.3;
  spinTime = 0;
  spinTimeTotal = Math.random() * 3000 + 4000;

  rotateWheel();
}

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

function stopRotateWheel() {
  clearTimeout(spinTimeout);
  const degrees = startAngle * 180 / Math.PI + 90;
  const arc = 360 / entries.length;
  const index = Math.floor((360 - degrees % 360) / arc);
  const winner = entries[index];

  document.getElementById('winnerResult').innerText = `🎉 Winner: ${winner}! 🎉`;

  // Confetti celebration
  confetti({
    particleCount: 200,
    spread: 70,
    origin: { y: 0.6 }
  });
}

function easeOut(t, b, c, d) {
  const ts = (t /= d) * t;
  const tc = ts * t;
  return b + c * (tc + -3 * ts + 3 * t);
}

function resetApp() {
  document.getElementById('numParticipants').value = '';
  document.getElementById('participantForm').innerHTML = '';
  document.getElementById('winnerResult').innerText = '';
  document.getElementById('pickWinner').style.display = 'none';
  document.getElementById('resetBtn').style.display = 'none';
  document.getElementById('wheelCanvas').style.display = 'none';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
