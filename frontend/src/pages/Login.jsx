import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link  } from "react-router-dom";
import auxin_logo from "../assets/auxin_logo.png";
import styles from "./Login.module.css";

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/login`, { username, password }, { withCredentials: true });

      // Store the token in localStorage
      localStorage.setItem("token", res.data.token);
      localStorage.setItem('username', res.data.username);
      console.log(res.data.username); 

      // Store the token and user data in localStorage
      localStorage.setItem("token", res.data.token);
      localStorage.setItem('username', res.data.username);
      localStorage.setItem('userId', res.data.user._id); // Add this line
      localStorage.setItem('role', res.data.user.role); // Store user role
      
      console.log("Login successful, user ID:", res.data.user._id);
      console.log("Stored user ID:", localStorage.getItem('userId'));
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Your Username/Password is incorrect!');
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.leftPanel}>
        <div className={styles.circle}></div>
        <div className={`${styles.circle} ${styles.circleExtra}`}></div>
        <div className={styles.welcomeBox}>
          <h1>
            Welcome back
            <br />
            to Auxin!
          </h1>
          <p>
            Login and continue where you left off! You will be
            <br />
            signed in based on your roles and permissions.
          </p>
        </div>
      </div>
      <div className={styles.rightPanel}>
        <div className={styles.loginBox}>
          <img src={auxin_logo} alt="Auxin Logo" className={styles.logo} />
          <div className={styles.formContainer}>
            <div className={styles.loginTitle}>
              Login to CRM
            </div>
            <div className={styles.formContent}>
              <div className={styles.inputContainer}>
                <div className={styles.inputField}>
                  <div className={styles.inputFieldBase}>
                    <div className={styles.inputWithLabel}>
                      <div className={styles.label}>
                        Username
                      </div>
                      <input
                        className={styles.input}
                        id="username"
                        type="text"
                        placeholder="EX. John Doe"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.inputField}>
                  <div className={styles.inputFieldBase}>
                    <div className={styles.inputWithLabel}>
                      <div className={styles.label}>
                        Password
                      </div>
                      <input
                        className={styles.input}
                        id="password"
                        type="password"
                        placeholder="**********"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    {error && (
                      <div className={styles.errorText}>
                        {error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button 
                type="submit" 
                className={styles.loginButton}
                onClick={handleSubmit}
              >
                Login
              </button>
              <div className={styles.forgotPasswordContainer}>
                <div className={styles.forgotPasswordText}>
                  Forgot Password?
                </div>
                {/* <a href="/forgotpassword" className={styles.forgotPasswordLink}>
                  Click Here
                </a> */}
                 <Link to="/forgotpassword" className={styles.forgotPasswordLink}>
                  Click Here
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
