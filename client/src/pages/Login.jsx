import React from 'react';
import auxin_logo from '../assets/auxin_logo.png';
import './Login.css';

function Login() {
  return (
    <div className="login-container ">
      <div className="left-panel">
        <div className="circle"></div>
        <div className="circle circle-extra"></div>
        <div className="welcome-box">
          <h1>
            Welcome back<br />to Auxin!
          </h1>
          <p>
            Login and continue where you left off! You will be<br />
            signed in based on your roles and permissions.
          </p>
        </div>
      </div>
      <div className="right-panel">
        <div className="login-box">
          <img
            src={auxin_logo}
            alt="Auxin Logo"
            className="logo"
          />
          <h3 className='text-start text-body mb-4 fs-5 fw-bold'>Login to CRM</h3>
          <form>
            <label htmlFor="username">Username</label>
            <input id="username" type="text" placeholder="Ex. John Doe" />
            

            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="************" />
            <span>Your Username/Password is incorrect!</span>
            <button type="submit">Login</button>
          </form>
          <p className="forgot-password">
            Forgot Password? <a href="#">Click Here</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
