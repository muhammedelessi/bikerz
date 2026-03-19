import { useState, useEffect, useRef } from 'react';

interface CountdownResult {
  timeLeft: string;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  hasExpiry: boolean;
}

var EMPTY_RESULT: CountdownResult = {
  timeLeft: '',
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  isExpired: false,
  hasExpiry: false,
};

var EXPIRED_RESULT: CountdownResult = {
  timeLeft: '00:00:00',
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  isExpired: true,
  hasExpiry: true,
};

function padTwo(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function computeCountdown(expiresAtMs: number): CountdownResult {
  var diff = expiresAtMs - Date.now();
  if (diff <= 0) {
    return EXPIRED_RESULT;
  }

  var d = Math.floor(diff / 86400000);
  var h = Math.floor((diff % 86400000) / 3600000);
  var m = Math.floor((diff % 3600000) / 60000);
  var s = Math.floor((diff % 60000) / 1000);
  var totalH = d * 24 + h;
  var timeLeft = padTwo(totalH) + ':' + padTwo(m) + ':' + padTwo(s);

  return { timeLeft: timeLeft, days: d, hours: h, minutes: m, seconds: s, isExpired: false, hasExpiry: true };
}

export var useDiscountCountdown = function (expiresAt: string | null | undefined): CountdownResult {
  var expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : 0;
  var hasExpiry = expiresAt != null && expiresAt !== '' && !isNaN(expiresAtMs);

  var initialResult = hasExpiry ? computeCountdown(expiresAtMs) : EMPTY_RESULT;
  var resultRef = useRef<CountdownResult>(initialResult);
  var rafRef = useRef<number>(0);
  var lastSecondRef = useRef<number>(-1);
  var _forceUpdate = useState(0);
  var setTick = _forceUpdate[1];

  useEffect(function () {
    if (!hasExpiry) return;

    function tick() {
      var next = computeCountdown(expiresAtMs);
      var currentSecond = next.days * 86400 + next.hours * 3600 + next.minutes * 60 + next.seconds;

      if (currentSecond !== lastSecondRef.current) {
        lastSecondRef.current = currentSecond;
        resultRef.current = next;
        setTick(function (c) { return c + 1; });
      }

      if (!next.isExpired) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return function () {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [hasExpiry, expiresAtMs]);

  return resultRef.current;
};
