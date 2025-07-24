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
              <label for="cashInput" class="tooltip">
                Total cost of goods
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
                <span class="tooltip-text">The amount you’ll pay upfront toward the purchase. Minimum deposit may apply based on term/service.</span>
              </label>
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

        function animateCount(element, start, end, duration = 1000, prefix = '£', suffix = '') {
          if (!element) return;
          let startTimestamp = null;
          const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const current = new Decimal(start).plus(new Decimal(end).minus(start).times(progress));
            element.textContent = `${prefix}${current.toDecimalPlaces(2)}${suffix}`;
            if (progress < 1) {
              window.requestAnimationFrame(step);
            }
          };
          window.requestAnimationFrame(step);
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
          container.querySelector("#depositInfo").textContent = `Minimum deposit: ${depositPercent}% of loan amount`;
        }

        function render() {
          if (!selectedTerm || isNaN(selectedTerm) || selectedTerm <= 0) {
            resultBox.innerHTML = `<p style="color:red;">Please select a valid term.</p>`;
            exampleBox.innerHTML = "";
            return;
          }

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

          const animatedSpan = (id) => `<span id="${id}">£0.00</span>`;

          let summaryHTML = `
            <div class="summary-section">
              <h3>Finance Details</h3>
              <p><strong>Total cost of goods:</strong> ${animatedSpan("cashPrice")}</p>
              <p><strong>Deposit:</strong> ${animatedSpan("deposit")}</p>
              <p><strong>Amount borrowed:</strong> ${animatedSpan("loanAmount")}</p>
              <p><strong>Repaid over:</strong> ${selectedTerm} months</p>
              <p><strong>Interest rate:</strong> ${apr.toString()}%</p>
              <p><strong>Representative APR:</strong> ${apr.toString()}% APR</p>
              ${
                selectedService === "BNPL" &&
                Array.isArray(serviceConfig.deferralterms) &&
                serviceConfig.deferralterms.includes(String(selectedTerm))
                  ? `<p><strong>Deferral period:</strong> 12 months</p>`
                  : ""
              }
            </div>
            <div class="output-section">
              <h3>Monthly & Total Repayments</h3>
              <p><strong>Interest payable:</strong> ${animatedSpan("interestPayable")}</p>
              <p><strong>Total payable:</strong> ${animatedSpan("totalPayable")}</p>
              <p><strong>Monthly repayment:</strong> ${animatedSpan("monthlyRepayment")}</p>
            </div>
          `;

          let monthlyInstalment, totalPayable, interestPayable;

          if (
            selectedService === "BNPL" &&
            Array.isArray(serviceConfig.deferralterms) &&
            serviceConfig.deferralterms.includes(String(selectedTerm))
          ) {
            deferralMonths = new Decimal(12);
            repaymentMonths = new Decimal(selectedTerm).minus(deferralMonths);
            const deferredInterest = loanAmount.times(monthlyRate.plus(1).pow(deferralMonths).minus(1));
            const adjustedLoanAmount = loanAmount.plus(deferredInterest);
            monthlyInstalment = adjustedLoanAmount.times(monthlyRate.div(monthlyRate.plus(1).pow(-repaymentMonths).minus(1).neg()));
            totalPayable = new Decimal(deposit).plus(monthlyInstalment.times(repaymentMonths));
            interestPayable = totalPayable.minus(cashPrice);
          } else if (apr.equals(0)) {
            monthlyInstalment = loanAmount.div(selectedTerm);
            totalPayable = new Decimal(deposit).plus(loanAmount);
            interestPayable = new Decimal(0);
          } else {
            const n = selectedTerm;
            const r = monthlyRate;
            monthlyInstalment = loanAmount.times(r.div(new Decimal(1).minus(new Decimal(1).plus(r).pow(-n))));
            totalPayable = new Decimal(deposit).plus(monthlyInstalment.times(n));
            interestPayable = totalPayable.minus(cashPrice);
          }

          resultBox.innerHTML = summaryHTML;

          animateCount(resultBox.querySelector("#cashPrice"), 0, cashPrice);
          animateCount(resultBox.querySelector("#deposit"), 0, deposit);
          animateCount(resultBox.querySelector("#loanAmount"), 0, loanAmount);
          animateCount(resultBox.querySelector("#interestPayable"), 0, interestPayable);
          animateCount(resultBox.querySelector("#totalPayable"), 0, totalPayable);
          animateCount(resultBox.querySelector("#monthlyRepayment"), 0, monthlyInstalment);

          exampleBox.innerHTML = `
            <strong>Representative Example:</strong><br>
            Borrowing £${loanAmount.toDecimalPlaces(2)} over ${selectedTerm} months at an interest rate of ${apr.toString()}% APR,<br>
            your monthly repayments will be £${monthlyInstalment.toDecimalPlaces(2)} and total amount payable £${totalPayable.toDecimalPlaces(2)}.
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
            selectedTerm = Number(firstBtn.textContent.replace(/\D/g, ""));
          }
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

        buildServiceOptions();
        buildTermButtons();
        updateDeposit();
        render();
      });
  });
}
