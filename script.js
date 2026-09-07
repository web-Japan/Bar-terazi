/* ============================================================
   BAR 立て看板サイト - script.js
   ------------------------------------------------------------
   index.html 専用のスクリプトです。
   answer.html にはインタラクティブな要素がないため、
   このファイルを読み込んでも安全に何もしないだけです。
   ============================================================ */

(function () {
  'use strict';

  // index.html 以外（answer.html等）で読み込まれた場合は
  // 必要な要素が無いため、ここで安全に処理を終える。
  var stage = document.getElementById('buttonStage');
  var yesBtn = document.getElementById('yesButton');
  var noBtn = document.getElementById('noButton');
  if (!stage || !yesBtn || !noBtn) {
    return;
  }

  var toast = document.getElementById('noToast');
  var veil = document.getElementById('transitionVeil');
  var seFail = document.getElementById('seFail');

  // ---- 「そっちは選べません。」的な一言メッセージのバリエーション ----
  var TOAST_MESSAGES = [
    '今日はYESでお願いします。',
    'そっちは選べません。',
    'それは無しで。'
  ];

  // NOボタンが逃げた回数（メッセージをランダムに変えるのに使用）
  var fleeCount = 0;

  // 直前の移動先との距離を確保するための記録
  var lastX = null;
  var lastY = null;

  var toastTimer = null;
  var isTransitioning = false;

  /* ------------------------------------------------------------
     NOボタンをステージ内のランダムな位置へ、画面内に収まる形で移動
  ------------------------------------------------------------ */
  function fleeNoButton() {
    if (isTransitioning) return;

    var stageRect = stage.getBoundingClientRect();
    var btnRect = noBtn.getBoundingClientRect();
    var yesRect = yesBtn.getBoundingClientRect();

    var btnW = btnRect.width || 112;
    var btnH = btnRect.height || 44;

    // ボタンがステージ内に完全に収まるための余白
    var margin = 8;
    var maxLeft = Math.max(margin, stageRect.width - btnW - margin);
    var maxTop = Math.max(margin, stageRect.height - btnH - margin);

    // YESボタンの範囲（ステージ内座標に変換）＋余白。ここには置かない。
    var yesLeftInStage = yesRect.left - stageRect.left - 24;
    var yesRightInStage = yesRect.right - stageRect.left + 24;
    var yesTopInStage = yesRect.top - stageRect.top - 16;
    var yesBottomInStage = yesRect.bottom - stageRect.top + 16;

    var candidate = null;
    var attempts = 0;

    while (attempts < 12) {
      attempts++;
      var x = margin + Math.random() * (maxLeft - margin);
      var y = margin + Math.random() * (maxTop - margin);

      var overlapsYes =
        x < yesRightInStage &&
        x + btnW > yesLeftInStage &&
        y < yesBottomInStage &&
        y + btnH > yesTopInStage;

      var tooCloseToLast =
        lastX !== null &&
        Math.abs(x - lastX) < btnW * 0.6 &&
        Math.abs(y - lastY) < btnH * 0.6;

      if (!overlapsYes && !tooCloseToLast) {
        candidate = { x: x, y: y };
        break;
      }
      // 妥協案として最後の候補を保持しておく
      candidate = { x: x, y: y };
    }

    if (!candidate) return;

    lastX = candidate.x;
    lastY = candidate.y;

    noBtn.style.left = (candidate.x + btnW / 2) + 'px';
    noBtn.style.top = (candidate.y + btnH / 2) + 'px';
    noBtn.style.transform = 'translate(-50%, -50%)';

    noBtn.classList.add('is-fleeing');
    fleeCount++;
  }

  /* ------------------------------------------------------------
     一瞬だけの短いメッセージを表示
  ------------------------------------------------------------ */
  function showToast() {
    if (!toast) return;
    var msg = TOAST_MESSAGES[fleeCount % TOAST_MESSAGES.length];
    toast.textContent = msg;
    toast.classList.add('is-visible');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 1400);
  }

  /* ------------------------------------------------------------
     失敗音（SE）の再生。ファイルが無い／再生できない場合も
     エラーを起こさず、サイトの動作に影響しないようにする。
  ------------------------------------------------------------ */
  function playFailSound() {
    if (!seFail) return;
    try {
      seFail.currentTime = 0;
      var playPromise = seFail.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {
          // 自動再生ブロックやファイル未配置の場合はここで静かに無視
        });
      }
    } catch (e) {
      // SE再生に失敗してもページは壊さない
    }
  }

  /* ------------------------------------------------------------
     PC: マウスカーソルがNOボタンに近づいたら逃げる
  ------------------------------------------------------------ */
  var HOVER_TRIGGER_DISTANCE = 70; // px

  stage.addEventListener('mousemove', function (e) {
    if (isTransitioning) return;
    var rect = noBtn.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var dx = e.clientX - cx;
    var dy = e.clientY - cy;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < HOVER_TRIGGER_DISTANCE) {
      fleeNoButton();
    }
  });

  /* ------------------------------------------------------------
     スマホ: タッチされた瞬間に逃げる（タップ成立を防ぐ）
  ------------------------------------------------------------ */
  noBtn.addEventListener(
    'touchstart',
    function (e) {
      if (isTransitioning) return;
      e.preventDefault(); // タップとしての確定（click発火）を防ぐ
      fleeNoButton();
      showToast();
    },
    { passive: false }
  );

  /* ------------------------------------------------------------
     万が一クリック（NOを押すことに成功した場合）
     - PCで運悪くクリックが成立してしまった場合や、
       タッチイベント非対応環境向けのフォールバック
  ------------------------------------------------------------ */
  noBtn.addEventListener('click', function (e) {
    e.preventDefault();
    if (isTransitioning) return;
    playFailSound();
    showToast();
    fleeNoButton();
  });

  /* ------------------------------------------------------------
     YESボタン：暗転 →「そんな貴方に。」→ answer.html へ遷移
  ------------------------------------------------------------ */
  yesBtn.addEventListener('click', function () {
    if (isTransitioning) return;
    isTransitioning = true;

    if (veil) {
      veil.classList.add('is-active');
    }

    // 元のURLパラメータ（?utm_source=signboard 等）を
    // answer.html にもそのまま引き継ぐ
    var query = window.location.search || '';

    setTimeout(function () {
      window.location.href = 'answer.html' + query;
    }, 1000); // 0.8〜1.2秒の間で遷移
  });
})();
