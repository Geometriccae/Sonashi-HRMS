import React from "react";
import styles from "./Dashboard.module.css"; // ✅ Correct CSS module import
import Side from "./sidebar/Sidebar";
import ClientsTable from "../components/ClientsTable";

import belldot from "../assets/dashboard/bell-dot.svg";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import admindemo from "../assets/dashboard/admin-demo.jpg";
import arrowupright from "../assets/dashboard/arrow-up-right.svg";
import arrowdownup from "../assets/dashboard/arrow-down-up.svg";

function Dash() {
  return (
    <div className={styles["dashboard-layout"]}>
      <Side />
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Sales & Leads</div>

            <div className={styles["dashboard-profile"]}>
              <img
                src={belldot}
                alt="belldot"
                className={styles["belldot-icon"]}
              />
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <img
                    src={admindemo}
                    alt=""
                    className={styles["profile-picture"]}
                  />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>Preety Sinha</div>
                    <div className={styles["profile-type"]}>Administrator</div>
                  </div>
                </div>
                <img src={chevrondown} alt="" />
              </div>
            </div>
          </div>
        </header>

        {/* breadcrumb */}
        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-two"]}>Sales and Leads</div>
          </div>
        </section>

        <section className= {styles.cardcontainer}>
          {/* Card 1 */}
          <div className={styles.cardbox}>
            <div className={styles.cardboxcontent}>
            <div className={styles.cardheader}>
              <h4>Total Receivables</h4>
              <div className={styles.iconlink}>
                <img src={arrowupright} alt="arrowup" />
              </div>
            </div>
            <h2>₹3,52,947</h2>
            <p className={styles.cardsuccess}>
              21% up <span>from last week</span>
            </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className={styles.cardbox}>
              <div className={styles.cardboxcontent}>
            <div className={styles.cardheader}>
              <h4>Total Payables</h4>
              <div className={styles.iconlink}>
                <img src={arrowupright} alt="arrowup" />
              </div>
            </div>
            <h2>₹12,947</h2>
            <p className={styles.cardfail}>
              1.5% down <span>from last week</span>
            </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className={`${styles.cardbox} ${styles.large}`}>
            <div className={styles.cardboxcontent}>
            <div className={styles.cardheader}>
              <div className={styles.cardname}>Monthly Spends</div>
              <div className={styles.iconlink}>
                <img src={arrowupright} alt="arrowup" />
              </div>
            </div>
            <div className={styles.cardamount}>
              <div className={styles.cardamountvalue}>₹113,364</div>
              <div className={styles.cardneutral}>↑ 0.4%</div>
            </div>

            <div className={styles.barchart}>

              <svg xmlns="http://www.w3.org/2000/svg" width="33" height="104" viewBox="0 0 33 104" fill="none">
  <path d="M0 8.89974C0 4.21782 3.79545 0.422363 8.47737 0.422363H23.5226C28.2046 0.422363 32 4.21781 32 8.89973V103.422H0V8.89974Z" fill="#FFF4E6"/>
  <path d="M32 33.8997C32 29.2178 28.2046 25.4224 23.5226 25.4224L8.47737 25.4224C3.79545 25.4224 5.39333e-06 29.2178 4.98784e-06 33.8997L-6.00329e-07 98.4224L32 98.4224L32 33.8997Z" fill="#FFCE8A"/>
  <path d="M0 49.8997C0 45.2178 3.79545 41.4224 8.47737 41.4224H23.7254C28.4074 41.4224 32.2028 45.2178 32.2028 49.8997V103.144H0V49.8997Z" fill="#FFAA33"/>
</svg>
<svg xmlns="http://www.w3.org/2000/svg" width="33" height="95" viewBox="0 0 33 95" fill="none">
  <path d="M1 8.89974C1 4.21781 4.79545 0.422363 9.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V94.4224H1V8.89974Z" fill="#FFF4E6"/>
  <path d="M33 29.8997C33 25.2178 29.2046 21.4224 24.5226 21.4224L9.47737 21.4224C4.79545 21.4224 1.00001 25.2178 1 29.8997L1 89.4224L33 89.4224L33 29.8997Z" fill="#FFCE8A"/>
  <path d="M0.621094 46.8997C0.621094 42.2178 4.41654 38.4224 9.09846 38.4224H24.3465C29.0284 38.4224 32.8239 42.2178 32.8239 46.8997V94.2405H0.621094V46.8997Z" fill="#FFAA33"/>
</svg>
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="87" viewBox="0 0 34 87" fill="none">
  <path d="M1 8.89974C1 4.21782 4.79545 0.422363 9.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V86.4224H1V8.89974Z" fill="#FFF4E6"/>
  <path d="M32.8 31.8997C32.8 27.2178 29.0046 23.4224 24.3227 23.4224L9.27742 23.4224C4.5955 23.4224 0.800054 27.2178 0.800054 31.8997L0.80005 81.4224L32.8 81.4224L32.8 31.8997Z" fill="#FFCE8A"/>
  <path d="M0.821045 68.8997C0.821045 64.2178 4.61649 60.4224 9.29841 60.4224H24.5465C29.2284 60.4224 33.0238 64.2178 33.0238 68.8997V86.7213H0.821045V68.8997Z" fill="#FFAA33"/>
</svg>
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="92" viewBox="0 0 34 92" fill="none">
  <path d="M1 8.89974C1 4.21782 4.79545 0.422363 9.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V91.4224H1V8.89974Z" fill="#FFF4E6"/>
  <path d="M33.4 28.8997C33.4 24.2178 29.6046 20.4224 24.9227 20.4224L8.8774 20.4224C4.19548 20.4224 0.400028 24.2178 0.400027 28.8997L0.400023 86.4224L33.4 86.4224L33.4 28.8997Z" fill="#FFCE8A"/>
  <path d="M1 66.8997C1 62.2178 4.79545 58.4224 9.47737 58.4224H24.7254C29.4074 58.4224 33.2028 62.2178 33.2028 66.8997V91.1619H1V66.8997Z" fill="#FFAA33"/>
</svg>
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="87" viewBox="0 0 34 87" fill="none">
  <path d="M1 8.89974C1 4.21782 4.79545 0.422363 9.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V86.4224H1V8.89974Z" fill="#FFF4E6"/>
  <path d="M32.8 31.8997C32.8 27.2178 29.0046 23.4224 24.3227 23.4224L9.27742 23.4224C4.5955 23.4224 0.800054 27.2178 0.800054 31.8997L0.80005 81.4224L32.8 81.4224L32.8 31.8997Z" fill="#FFCE8A"/>
  <path d="M0.821045 68.8997C0.821045 64.2178 4.61649 60.4224 9.29841 60.4224H24.5465C29.2284 60.4224 33.0238 64.2178 33.0238 68.8997V86.7213H0.821045V68.8997Z" fill="#FFAA33"/>
</svg>
<svg xmlns="http://www.w3.org/2000/svg" width="33" height="105" viewBox="0 0 33 105" fill="none">
  <path d="M0 8.89973C0 4.21781 3.79545 0.422363 8.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V104.422H0V8.89973Z" fill="#FFF4E6"/>
  <path d="M33 33.4774C33 28.7955 29.2046 25 24.5226 25L8.47738 25C3.79546 25 7.30068e-06 28.7954 6.89519e-06 33.4774L1.30702e-06 98L33 98L33 33.4774Z" fill="#FFCE8A"/>
  <path d="M0 49.4774C0 44.7954 3.79545 41 8.47737 41H24.5226C29.2046 41 33 44.7954 33 49.4774V104H0V49.4774Z" fill="#FFAA33"/>
</svg>
<svg xmlns="http://www.w3.org/2000/svg" width="33" height="100" viewBox="0 0 33 100" fill="none">
  <path d="M0 8.89973C0 4.21781 3.79545 0.422363 8.47737 0.422363H23.5226C28.2046 0.422363 32 4.21781 32 8.89973V99.4224H0V8.89973Z" fill="#FFF4E6"/>
  <path d="M33 32.8997C33 28.2178 29.2046 24.4224 24.5226 24.4224L9.47737 24.4224C4.79545 24.4224 1.00001 28.2178 1 32.8997L1 95.4224L33 95.4224L33 32.8997Z" fill="#FFCE8A"/>
  <path d="M0 75.4774C0 70.7954 3.79545 67 8.47737 67H24.5226C29.2046 67 33 70.7954 33 75.4774V99H0V75.4774Z" fill="#FFAA33"/>
</svg>
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="87" viewBox="0 0 34 87" fill="none">
  <path d="M1 8.89974C1 4.21782 4.79545 0.422363 9.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V86.4224H1V8.89974Z" fill="#FFF4E6"/>
  <path d="M32.8 31.8997C32.8 27.2178 29.0046 23.4224 24.3227 23.4224L9.27742 23.4224C4.5955 23.4224 0.800054 27.2178 0.800054 31.8997L0.80005 81.4224L32.8 81.4224L32.8 31.8997Z" fill="#FFCE8A"/>
  <path d="M0.821045 68.8997C0.821045 64.2178 4.61649 60.4224 9.29841 60.4224H24.5465C29.2284 60.4224 33.0238 64.2178 33.0238 68.8997V86.7213H0.821045V68.8997Z" fill="#FFAA33"/>
</svg>
<svg xmlns="http://www.w3.org/2000/svg" width="33" height="105" viewBox="0 0 33 105" fill="none">
  <path d="M0 8.89973C0 4.21781 3.79545 0.422363 8.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V104.422H0V8.89973Z" fill="#FFF4E6"/>
  <path d="M33 33.4774C33 28.7955 29.2046 25 24.5226 25L8.47738 25C3.79546 25 7.30068e-06 28.7954 6.89519e-06 33.4774L1.30702e-06 98L33 98L33 33.4774Z" fill="#FFCE8A"/>
  <path d="M0 49.4774C0 44.7954 3.79545 41 8.47737 41H24.5226C29.2046 41 33 44.7954 33 49.4774V104H0V49.4774Z" fill="#FFAA33"/>
</svg>
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="87" viewBox="0 0 34 87" fill="none">
  <path d="M1 8.89974C1 4.21782 4.79545 0.422363 9.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V86.4224H1V8.89974Z" fill="#FFF4E6"/>
  <path d="M32.8 31.8997C32.8 27.2178 29.0046 23.4224 24.3227 23.4224L9.27742 23.4224C4.5955 23.4224 0.800054 27.2178 0.800054 31.8997L0.80005 81.4224L32.8 81.4224L32.8 31.8997Z" fill="#FFCE8A"/>
  <path d="M0.821045 68.8997C0.821045 64.2178 4.61649 60.4224 9.29841 60.4224H24.5465C29.2284 60.4224 33.0238 64.2178 33.0238 68.8997V86.7213H0.821045V68.8997Z" fill="#FFAA33"/>
</svg>
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="87" viewBox="0 0 34 87" fill="none">
  <path d="M1 8.89974C1 4.21782 4.79545 0.422363 9.47737 0.422363H24.5226C29.2046 0.422363 33 4.21781 33 8.89973V86.4224H1V8.89974Z" fill="#FFF4E6"/>
  <path d="M32.8 31.8997C32.8 27.2178 29.0046 23.4224 24.3227 23.4224L9.27742 23.4224C4.5955 23.4224 0.800054 27.2178 0.800054 31.8997L0.80005 81.4224L32.8 81.4224L32.8 31.8997Z" fill="#FFCE8A"/>
  <path d="M0.821045 68.8997C0.821045 64.2178 4.61649 60.4224 9.29841 60.4224H24.5465C29.2284 60.4224 33.0238 64.2178 33.0238 68.8997V86.7213H0.821045V68.8997Z" fill="#FFAA33"/>
</svg>
<svg xmlns="http://www.w3.org/2000/svg" width="33" height="100" viewBox="0 0 33 100" fill="none">
  <path d="M0 8.89973C0 4.21781 3.79545 0.422363 8.47737 0.422363H23.5226C28.2046 0.422363 32 4.21781 32 8.89973V99.4224H0V8.89973Z" fill="#FFF4E6"/>
  <path d="M33 32.8997C33 28.2178 29.2046 24.4224 24.5226 24.4224L9.47737 24.4224C4.79545 24.4224 1.00001 28.2178 1 32.8997L1 95.4224L33 95.4224L33 32.8997Z" fill="#FFCE8A"/>
  <path d="M0.178955 75.8997C0.178955 71.2178 3.9744 67.4224 8.65632 67.4224H23.9044C28.5863 67.4224 32.3818 71.2178 32.3818 75.8997V99.0884H0.178955V75.8997Z" fill="#FFAA33"/>
</svg>
              
            </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className={styles["main-content"]}>
          <ClientsTable />
        </section>
      </main>
    </div>
  );
}

export default Dash;
