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
          <h2>${options.labels.results}</h2>

          <div class="inputs-row">
            <div class="input-group">
              <label for="cashInput">${options.labels.amount}</label>
              <div class="input-wrapper">
                <span class="currency-symbol">£</span>
                <input type="number" id="cashInput" min="${config.limits.minLoan}" max="${config.limits.maxLoan}" step="1000" value="${cashPrice}" />
              </div>
            </div>

            <div class="input-group">
              <label for="depositInput">${options.labels.deposit}</label>
              <div class="input-wrapper">
                <span class="currency-symbol">£</span>
                <input type="number" id="depositInput" min="${config.limits.minDeposit}" max="${config.limits.maxDeposit}" step="1" value="${deposit}" />
              </div>
              <small id="depositInfo" style="color: #ffffff; font-size: 0.85em; margin-top: 5px; display: block;"></small>
            </div>
          </div>

          <label>${options.labels.service}</label>
          <div id="serviceOptions"></div>

          <label>${options.labels.term}</label>
          <div id="termButtons"></div>

          <div id="resultBox"></div>
          <div id="exampleBox"></div>
        `;

        const serviceOptions = container.querySelector("#serviceOptions");
        const termButtons = container.querySelector("#termButtons");
        const cashInput = container.querySelector("#cashInput");
        const depositInput = container.querySelector("#depositInput");
        const resultBox = container.querySelector("#resultBox");
        const exampleBox = container.querySelector("#exampleBox");

        function buildServiceOptions() {
          serviceOptions.innerHTML = "";

          Object.keys(config.services).forEach(service => {
            const btn = document.createElement("button");
            btn.textContent = service;
            btn.dataset.service = service;
            btn.className = "pbf_button";

            if (service === selectedService) {
              btn.classList.add("active");
            }

            btn.addEventListener("click", () => {
              document.querySelectorAll("#serviceOptions button").forEach(b => b.classList.remove("active"));
              btn.classList.add("active");
              selectedService = service;
              updateDeposit();
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
            btn.dataset.term = term;
            btn.className = "pbf_button";

            btn.addEventListener("click", () => {
              document.querySelectorAll("#termButtons button").forEach(b => b.classList.remove("active"));
              btn.classList.add("active");
              selectedTerm = Number(term);
              updateDeposit();
              render();
            });

            termButtons.appendChild(btn);
          });

          const firstBtn = termButtons.querySelector("button");
          if (firstBtn) {
            firstBtn.classList.add("active");
            selectedTerm = Number(firstBtn.dataset.term);
          }
        }

        function updateDeposit() {
          const serviceConfig = config.services[selectedService];
          const limits = config.limits;

          let depositPercent = serviceConfig.depositPercent ?? limits.minDeposit;

          const termConfig = serviceConfig.terms?.[selectedTerm];
          if (termConfig?.minDepositOverride) {
            depositPercent = termConfig.minDepositOverride;
          }

          depositPercent = Math.max(limits.minDeposit, Math.min(depositPercent, limits.maxDeposit));

          deposit = (cashPrice * depositPercent) / 100;
          depositInput.value = deposit.toFixed(2);

          // Show minimum deposit percentage message below deposit input
          const depositInfo = container.querySelector("#depositInfo");
          depositInfo.textContent = `Minimum deposit: ${depositPercent}% of loan amount`;
        }

        cashInput.addEventListener("input", () => {
          cashPrice = Number(cashInput.value);
          updateDeposit();
          render();
        });

        depositInput.addEventListener("input", () => {
          deposit = Number(depositInput.value);
          render();
        });

        function animateCount(element, start, end, duration = 1000) {
          let startTimestamp = null;
          const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const current = new Decimal(start).plus(new Decimal(end).minus(start).times(progress));
            element.textContent = current.toDecimalPlaces(2).toString();
            if (progress < 1) {
              window.requestAnimationFrame(step);
            }
          };
          window.requestAnimationFrame(step);
        }

        function render() {
          const serviceConfig = config.services[selectedService];
          const apr = new Decimal(serviceConfig.apr || 0);
          const cashPriceFormatted = new Decimal(cashPrice).toDecimalPlaces(2).toString();
          const depositFormatted = new Decimal(deposit).toDecimalPlaces(2).toString();
          const loanAmount = new Decimal(cashPrice).minus(deposit);

          if (loanAmount.lte(0)) {
            resultBox.innerHTML = `<p style="color:red;">Loan amount must be positive.</p>`;
            exampleBox.innerHTML = ""; // clear example if invalid
            return;
          }

          const monthlyRate = apr.div(100).div(12);

          // BNPL with deferral logic
          if (
            selectedService === "BNPL" &&
            Array.isArray(serviceConfig.deferralterms) &&
            serviceConfig.deferralterms.includes(String(selectedTerm))
          ) {
            const deferralMonths = new Decimal(12);
            const totalTerm = new Decimal(selectedTerm);
            const repaymentMonths = totalTerm.minus(deferralMonths);

            if (repaymentMonths.lte(0)) {
              resultBox.innerHTML = `<p style="color:red;">Repayment months must be positive.</p>`;
              exampleBox.innerHTML = "";
              return;
            }

            const deferredInterest = loanAmount.times(monthlyRate.plus(1).pow(deferralMonths).minus(1));
            const adjustedLoanAmount = loanAmount.plus(deferredInterest);

            const monthlyInstalment = adjustedLoanAmount.times(monthlyRate.div(monthlyRate.plus(1).pow(-repaymentMonths).minus(1).neg()));
            const totalPayable = new Decimal(deposit).plus(monthlyInstalment.times(repaymentMonths));
            const interestPayable = totalPayable.minus(cashPrice);

            resultBox.innerHTML = `
              <div class="summary-section">
                <h3>Finance Details</h3>
                <p><strong>Total cost:</strong> £${cashPriceFormatted}</p>
                <p><strong>Deposit:</strong> £${depositFormatted}</p>
                <p><strong>Amount Borrowed:</strong> £${loanAmount.toDecimalPlaces(2).toString()}</p>
                <p><strong>Repaid over:</strong> ${repaymentMonths.toString()} months</p>
                <p><strong>Deferred for:</strong> ${deferralMonths.toString()} months</p>
                <p><strong>Interest Rate:</strong> ${apr.toString()}%</p>
                <p><strong>APR:</strong> ${apr.toString()}% APR</p>
              </div>

              <div class="output-section">
                <h3>Monthly & Total Repayments</h3>
                <p><strong>Interest payable:</strong> £<span id="interestPayable">0.00</span></p>
                <p><strong>Total payable:</strong> £<span id="totalPayable">0.00</span></p>
                <p><strong>Monthly repayment:</strong> £<span id="monthlyRepayment">0.00</span></p>
              </div>
            `;

            animateCount(resultBox.querySelector("#monthlyRepayment"), 0, monthlyInstalment);
            animateCount(resultBox.querySelector("#totalPayable"), 0, totalPayable);
            animateCount(resultBox.querySelector("#interestPayable"), 0, interestPayable);

            // Representative example for BNPL
            exampleBox.innerHTML = `
              <strong>Representative Example:</strong><br>
              Borrowing £${loanAmount.toDecimalPlaces(2).toString()} over ${repaymentMonths.toString()} months at an interest rate of ${apr.toString()}% APR,<br>
              your monthly repayments will be £${monthlyInstalment.toDecimalPlaces(2).toString()} and total amount payable £${totalPayable.toDecimalPlaces(2).toString()}.
            `;
          }

          // Interest Free logic
          else if (apr.equals(0)) {
            const monthlyInstalment = loanAmount.div(selectedTerm);
            const totalPayable = new Decimal(deposit).plus(loanAmount);

            resultBox.innerHTML = `
              <div class="summary-section">
                <h3>Finance Details</h3>
                <p><strong>Total cost:</strong> £${cashPriceFormatted}</p>
                <p><strong>Deposit:</strong> £${depositFormatted}</p>
                <p><strong>Amount Borrowed:</strong> £${loanAmount.toDecimalPlaces(2).toString()}</p>
                <p><strong>Repaid over:</strong> ${selectedTerm} months</p>
                <p><strong>Interest Rate:</strong> 0%</p>
                <p><strong>APR:</strong> 0% APR</p>
              </div>

              <div class="output-section">
                <h3>Monthly & Total Repayments</h3>
                <p><strong>Interest payable:</strong> £<span id="interestPayable">0.00</span></p>
                <p><strong>Total payable:</strong> £<span id="totalPayable">0.00</span></p>
                <p><strong>Monthly repayment:</strong> £<span id="monthlyRepayment">0.00</span></p>
              </div>
            `;

            animateCount(resultBox.querySelector("#monthlyRepayment"), 0, monthlyInstalment);
            animateCount(resultBox.querySelector("#totalPayable"), 0, totalPayable);
            animateCount(resultBox.querySelector("#interestPayable"), 0, new Decimal(0));

            exampleBox.innerHTML = `
              <strong>Representative Example:</strong><br>
              Borrowing £${loanAmount.toDecimalPlaces(2).toString()} over ${selectedTerm} months with 0% interest,<br>
              your monthly repayments will be £${monthlyInstalment.toDecimalPlaces(2).toString()} and total amount payable £${totalPayable.toDecimalPlaces(2).toString()}.
            `;
          }

          // Standard APR interest logic
          else {
            // Standard amortized loan formula
            const n = selectedTerm;
            const r = monthlyRate;

            // Monthly repayment calculation
            const monthlyInstalment = loanAmount.times(
              r.div(
                new Decimal(1).minus(new Decimal(1).plus(r).pow(-n))
              )
            );
            const totalPayable = new Decimal(deposit).plus(monthlyInstalment.times(n));
            const interestPayable = totalPayable.minus(cashPrice);

            resultBox.innerHTML = `
              <div class="summary-section">
                <h3>Finance Details</h3>
                <p><strong>Total cost:</strong> £${cashPriceFormatted}</p>
                <p><strong>Deposit:</strong> £${depositFormatted}</p>
                <p><strong>Amount Borrowed:</strong> £${loanAmount.toDecimalPlaces(2).toString()}</p>
                <p><strong>Repaid over:</strong> ${selectedTerm} months</p>
                <p><strong>Interest Rate:</strong> ${apr.toString()}%</p>
                <p><strong>APR:</strong> ${apr.toString()}% APR</p>
              </div>

              <div class="output-section">
                <h3>Monthly & Total Repayments</h3>
                <p><strong>Interest payable:</strong> £<span id="interestPayable">0.00</span></p>
                <p><strong>Total payable:</strong> £<span id="totalPayable">0.00</span></p>
                <p><strong>Monthly repayment:</strong> £<span id="monthlyRepayment">0.00</span></p>
              </div>
            `;

            animateCount(resultBox.querySelector("#monthlyRepayment"), 0, monthlyInstalment);
            animateCount(resultBox.querySelector("#totalPayable"), 0, totalPayable);
            animateCount(resultBox.querySelector("#interestPayable"), 0, interestPayable);

            exampleBox.innerHTML = `
              <strong>Representative Example:</strong><br>
              Borrowing £${loanAmount.toDecimalPlaces(2).toString()} over ${selectedTerm} months at an interest rate of ${apr.toString()}% APR,<br>
              your monthly repayments will be £${monthlyInstalment.toDecimalPlaces(2).toString()} and total amount payable £${totalPayable.toDecimalPlaces(2).toString()}.
            `;
          }
        }

        buildServiceOptions();
        buildTermButtons();
        updateDeposit();
        render();
      });
  });
}
