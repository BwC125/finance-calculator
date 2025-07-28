function financeCalculator(options) {
  document.addEventListener("DOMContentLoaded", () => {
    fetch(options.config)
      .then(res => res.json())
      .then(config => {
        const container = document.querySelector(options.target);
        let selectedService = "Interest Free";
        let selectedTerm = 12;
        let cashPrice = 3000;
        let deposit = 0;

        container.innerHTML = `
          <style>
            .input-error {
              border: 2px solid red !important;
              outline: none;
            }
            .tooltip {
              position: relative;
              display: inline-flex;
              align-items: center;
              gap: 4px;
              cursor: help;
            }
            .tooltip-icon {
              margin-left: 4px;
              color: #d4d4d4ff;
              font-weight: bold;
              font-size: 0.9em;
              transition: color 0.3s ease;
            }
            .tooltip:hover .tooltip-icon {
              color: #4cc4fc;
            }
            .tooltip .tooltip-text {
              visibility: hidden;
              width: 240px;
              background: #202C44;
              color: #ffffff;
              text-align: left;
              border-radius: 8px;
              padding: 10px;
              position: absolute;
              z-index: 1;
              bottom: 125%;
              left: 0;
              opacity: 0;
              transition: opacity 0.3s;
              font-size: 0.9em;
              line-height: 1.4em;
            }
            .tooltip:hover .tooltip-text {
              visibility: visible;
              opacity: 1;
            }
          </style>

          <h2>${options.labels.results}</h2>
          <div class="calculator-disclaimer">
          <span class="disclaimer-icon">ⓘ</span>
          This calculator provides indicative figures for illustration purposes only. Actual rates, terms, and repayments may vary depending on the lender’s assessment and final offer.
          </div>

          <div class="inputs-row">
            <div class="input-group">
              <label for="cashInput" class="tooltip">
                Total cost of goods
                <span class="tooltip-icon">ⓘ</span>
                <span class="tooltip-text">Enter the total cost of the product or service you're financing.</span>
              </label>
              <div class="input-wrapper">
                <span class="currency-symbol">£</span>
                <input type="number" id="cashInput" min="${config.limits.minLoan}" max="${config.limits.maxLoan}" step="1000" value="${cashPrice}" />
              </div>
            </div>

            <div class="input-group">
              <label for="depositInput" class="tooltip">
                ${options.labels.deposit}
                <span class="tooltip-icon">ⓘ</span>
                <span class="tooltip-text">The amount you’ll pay upfront toward the purchase. Minimum deposit may apply based on term/service.</span>
              </label>
              <div class="input-wrapper">
                <span class="currency-symbol">£</span>
                <input type="number" id="depositInput" step="1" value="${deposit}" />
              </div>
              <small id="depositInfo" style="color: #ffffff; font-size: 0.85em; margin-top: 5px; display: block;"></small>
            </div>
          </div>

          <label>${options.labels.service}</label>
          <div id="serviceOptions"></div>

          <label>${options.labels.term}</label>
          <div id="termButtons"></div>

          <div id="resultBox"></div>
          <div id="exampleBox">
          <div class="example-heading">Representative Example</div>
          <div class="example-heading">
          Representative Example
          <span class="example-badge">Example</span>
          </div>
          <p>If you purchase goods costing <strong>£3,000.00</strong> and pay a <strong>£300.00</strong> deposit, the amount of credit will be <strong>£2,700.00</strong>.</p>
          <p>You will repay this over <strong>120 months</strong> at an interest rate of <strong>6.9%</strong> per annum (fixed).</p>
          <p>The total charge for credit will be <strong>£1,011.60</strong>.</p>
          <p>Overall amount repayable: <strong>£4,011.60</strong>, in monthly repayments of <strong>£30.93</strong>.</p>
          </div>
        `;

        const serviceOptions = container.querySelector("#serviceOptions");
        const termButtons = container.querySelector("#termButtons");
        const cashInput = container.querySelector("#cashInput");
        const depositInput = container.querySelector("#depositInput");
        const resultBox = container.querySelector("#resultBox");
        const exampleBox = container.querySelector("#exampleBox");

        function animateCount(element, start, end, duration = 1000, prefix = '£', suffix = '') {
          if (!element) return;
          let startTimestamp = null;
          const isDeposit = element.id === "deposit";
          const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const current = new Decimal(start).plus(new Decimal(end).minus(start).times(progress));
            const displayValue = isDeposit
              ? Math.round(current)
              : Number(current).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            element.textContent = `${prefix}${displayValue}${suffix}`;
            if (progress < 1) window.requestAnimationFrame(step);
          };
          window.requestAnimationFrame(step);
        }

        function updateDeposit(forceSet = false) {
          const serviceConfig = config.services[selectedService];
          const limits = config.limits;
          let depositPercent = serviceConfig.depositPercent !== undefined ? serviceConfig.depositPercent : limits.minDeposit;

          const termConfig = serviceConfig.terms?.[selectedTerm];
          if (termConfig?.minDepositOverride !== undefined) {
            depositPercent = termConfig.minDepositOverride;
          }

          depositPercent = Math.max(limits.minDeposit, Math.min(depositPercent, limits.maxDeposit));
          const minDepositValue = (cashPrice * depositPercent) / 100;
          depositInput.min = Math.round(minDepositValue);

          if (forceSet && (isNaN(deposit) || deposit < minDepositValue)) {
            deposit = Math.round(minDepositValue);
            depositInput.value = deposit;
          }

          container.querySelector("#depositInfo").textContent = `Minimum deposit: ${depositPercent}% of cost of goods`;
          return minDepositValue;
        }

function render() {
  const serviceConfig = config.services[selectedService];
  const apr = new Decimal(serviceConfig.apr || 0);
  const loanAmount = new Decimal(cashPrice).minus(deposit);

  if (loanAmount.lte(0)) {
    resultBox.innerHTML = `<p style="color:red;">Loan amount must be positive.</p>`;
    exampleBox.innerHTML = "";
    return;
  }

  const monthlyRate = apr.div(100).div(12);
  let repaymentMonths, deferralMonths;
  let repaymentDisplayMonths = selectedTerm;

  if (
    selectedService === "BNPL" &&
    Array.isArray(serviceConfig.deferralterms) &&
    serviceConfig.deferralterms.includes(String(selectedTerm))
  ) {
    deferralMonths = 12;
    repaymentMonths = new Decimal(selectedTerm).minus(deferralMonths);
    repaymentDisplayMonths = repaymentMonths.toNumber();
  } else {
    repaymentMonths = new Decimal(selectedTerm);
  }

  const termConfig = serviceConfig.terms?.[selectedTerm];
  const fixedMonthlyRate = termConfig?.monthlyPerThousand;

  let monthlyInstalment, totalPayable, interestPayable;

  if (fixedMonthlyRate) {
    // 🔷 Fixed monthly repayment per £1,000
    monthlyInstalment = loanAmount.div(1000).times(fixedMonthlyRate);
    totalPayable = new Decimal(deposit).plus(monthlyInstalment.times(selectedTerm));
    interestPayable = totalPayable.minus(cashPrice);
  } else if (selectedService === "BNPL" && deferralMonths) {
    // 🔷 BNPL deferral logic
    const deferredInterest = loanAmount.times(monthlyRate.plus(1).pow(deferralMonths).minus(1));
    const adjustedLoanAmount = loanAmount.plus(deferredInterest);
    monthlyInstalment = adjustedLoanAmount.times(
      monthlyRate.div(monthlyRate.plus(1).pow(-repaymentMonths).minus(1).neg())
    );
    totalPayable = new Decimal(deposit).plus(monthlyInstalment.times(repaymentMonths));
    interestPayable = totalPayable.minus(cashPrice);
  } else if (apr.equals(0)) {
    // 🔷 Interest-Free logic
    monthlyInstalment = loanAmount.div(selectedTerm);
    totalPayable = new Decimal(deposit).plus(loanAmount);
    interestPayable = new Decimal(0);
  } else {
    // 🔷 APR-based fallback
    const n = selectedTerm;
    const r = monthlyRate;
    monthlyInstalment = loanAmount.times(
      r.div(new Decimal(1).minus(new Decimal(1).plus(r).pow(-n)))
    );
    totalPayable = new Decimal(deposit).plus(monthlyInstalment.times(n));
    interestPayable = totalPayable.minus(cashPrice);
  }

  resultBox.innerHTML = `
    <div class="summary-section">
      <h3>Finance Details</h3>
      <p><strong>Total cost of goods:</strong> <span id="cashPrice">£0.00</span></p>
      <p><strong>Deposit:</strong> <span id="deposit">£0</span></p>
      <p><strong>Amount borrowed:</strong> <span id="loanAmount">£0.00</span></p>
      <p><strong>Repaid over:</strong> ${repaymentDisplayMonths} months</p>
      ${deferralMonths ? `<p><strong>Deferral period:</strong> ${deferralMonths} months</p>` : ""}
      <p><strong>Interest rate:</strong> ${apr.toString()}%</p>
      <p><strong>Representative APR:</strong> ${apr.toString()}% APR</p>
    </div>
    <div class="output-section">
      <h3>Monthly & Total Repayments</h3>
      <p><strong>Interest payable:</strong> <span id="interestPayable">£0.00</span></p>
      <p><strong>Total payable:</strong> <span id="totalPayable">£0.00</span></p>
      <p><strong>Monthly repayment:</strong> <span id="monthlyRepayment">£0.00</span></p>
    </div>
  `;

  animateCount(resultBox.querySelector("#cashPrice"), 0, cashPrice);
  animateCount(resultBox.querySelector("#deposit"), 0, deposit);
  animateCount(resultBox.querySelector("#loanAmount"), 0, loanAmount);
  animateCount(resultBox.querySelector("#interestPayable"), 0, interestPayable);
  animateCount(resultBox.querySelector("#totalPayable"), 0, totalPayable);
  animateCount(resultBox.querySelector("#monthlyRepayment"), 0, monthlyInstalment);

  exampleBox.innerHTML = `
  <div class="rep-example-card">
    <div class="rep-example-header">
      <span class="rep-badge">Representative Example</span>
    </div>
    <div class="rep-example-content">
      <p>If you purchase goods costing <strong>£${cashPrice.toFixed(2)}</strong> and pay a <strong>£${deposit.toFixed(2)}</strong> deposit, the amount of credit will be <strong>£${loanAmount.toFixed(2)}</strong>.</p>
      <p>You will repay this over <strong>${selectedTerm} months</strong> at an interest rate of <strong>${apr.toFixed(1)}%</strong> per annum (fixed).</p>
      <p>The total charge for credit will be <strong>£${interestPayable.toFixed(2)}</strong>.</p>
      <p>Overall amount repayable: <strong>£${totalPayable.toFixed(2)}</strong>, in monthly repayments of <strong>£${monthlyInstalment.toFixed(2)}</strong>.</p>
    </div>
  </div>
`;
}


        function buildServiceOptions() {
          serviceOptions.innerHTML = "";
          Object.keys(config.services).forEach(service => {
            const btn = document.createElement("button");
            btn.textContent = service;
            btn.className = "pbf_button";
            if (service === selectedService) btn.classList.add("active");
            btn.addEventListener("click", () => {
              document.querySelectorAll("#serviceOptions button").forEach(b => b.classList.remove("active"));
              btn.classList.add("active");
              selectedService = service;
              updateDeposit(true);
              buildTermButtons();
              render();
            });
            serviceOptions.appendChild(btn);
          });
        }

        function buildTermButtons() {
          const terms = Object.keys(config.services[selectedService].terms || {});
          termButtons.innerHTML = "";
          terms.forEach(term => {
            const btn = document.createElement("button");
            btn.textContent = `${term} months`;
            btn.className = "pbf_button";
            btn.addEventListener("click", () => {
              document.querySelectorAll("#termButtons button").forEach(b => b.classList.remove("active"));
              btn.classList.add("active");
              selectedTerm = Number(term);
              updateDeposit(true);
              render();
            });
            termButtons.appendChild(btn);
          });

          const firstBtn = termButtons.querySelector("button");
          if (firstBtn) {
            firstBtn.classList.add("active");
            selectedTerm = Number(firstBtn.textContent.replace(/\D/g, ""));
          }
        }

        cashInput.addEventListener("input", () => {
          cashPrice = Number(cashInput.value);
          updateDeposit(true);
          render();
        });

        depositInput.addEventListener("input", () => {
          let inputValue = Number(depositInput.value);
          if (isNaN(inputValue)) inputValue = 0;
          deposit = inputValue;

          const minDeposit = updateDeposit(false);
          const errorMsg = container.querySelector("#depositError");

          const isValid = !isNaN(minDeposit) && deposit >= minDeposit && deposit <= cashPrice;

          if (!isValid) {
            depositInput.classList.add("input-error");

            if (!errorMsg) {
              const msg = document.createElement("small");
              msg.id = "depositError";
              msg.style.color = "red";
              msg.style.fontSize = "0.85em";
              msg.style.marginTop = "5px";
              msg.textContent = `Deposit must be at least £${Math.round(minDeposit)} (${((minDeposit / cashPrice) * 100).toFixed(1)}%)`;

              const group = depositInput.closest(".input-group");
              group.appendChild(msg);
            } else {
              errorMsg.textContent = `Deposit must be at least £${Math.round(minDeposit)} (${((minDeposit / cashPrice) * 100).toFixed(1)}%)`;
            }
          } else {
            depositInput.classList.remove("input-error");
            if (errorMsg) errorMsg.remove();
          }

          render();
        });

        depositInput.addEventListener("blur", () => {
          const rawValue = Number(depositInput.value);
          const minDeposit = updateDeposit();
          const clamped = Math.max(minDeposit, Math.min(rawValue, cashPrice));

          deposit = Math.round(clamped);
          depositInput.value = deposit;

          const errorMsg = container.querySelector("#depositError");

          if (deposit >= minDeposit && deposit <= cashPrice) {
            depositInput.classList.remove("input-error");
            if (errorMsg) errorMsg.remove();
          }

          render();
        });

        buildServiceOptions();
        buildTermButtons();
        updateDeposit(true);
        render();
      });
  });
}
