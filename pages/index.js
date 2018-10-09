class IndexPage extends React.Component {
  signIn() {
    fetch("http://localhost:3001/sign-in", {
      redirect: "follow"
    });
  }
  render() {
    return (
      <div>
        <h1>Hello</h1>
        <button onClick={this.signIn}>Sign In with Twitter</button>
      </div>
    );
  }
}

export default IndexPage;
