import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import auxin_logo from "../assets/auxin_logo.png";
import "./Login.css";

function Login() {
 const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', {
        username,
        password
      });

     // Store the token in localStorage
  localStorage.setItem("token", res.data.token);
 localStorage.setItem('username', res.data.username);
 console.log(res.data.username); 
  // Navigate to dashboard
  navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Invalid username or password');
    }
  };


  return (
    <div className="login-container ">
      <div className="left-panel">
        <div className="circle"></div>
        <div className="circle circle-extra"></div>
        <div className="welcome-box">
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
      <div className="right-panel">
        <div className="login-box">
          <img src={auxin_logo} alt="Auxin Logo" className="logo" />
          <h3 className="text-start text-body mb-4 fs-5 fw-bold">
            Login to CRM
          </h3>
          {/* <form>
            <label htmlFor="username">Username</label>
            <input id="username" type="text" placeholder="Ex. John Doe" />
            

            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="************" />
            <span>Your Username/Password is incorrect!</span>
            <button type="submit">Login</button>
          </form> */}
          <form onSubmit={handleSubmit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Ex. John Doe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="************"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <span style={{ color: 'red' }}>{error}</span>}
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


